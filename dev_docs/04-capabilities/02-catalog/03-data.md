# Каталог: хранилище, секреты и файлы

Статус: design document, версия каталога `0.1`  
Назначение: изолированное хранилище приложения, секреты и доступ к файлам.

Смежные документы: [правила каталога](./00-index.md), [общие типы](./01-common-types.md), [данные приложения](../../03-apps/06-app-data-api.md).

## Хранилище — `storage.local.*`, `storage.replicated.*`, `storage.cache.*`, `storage.tmp.*` — v0

Приложение выбирает семантику данных, а не алгоритм репликации.

```wit
interface store {
  enum namespace { local, replicated, cache, tmp }
  enum consistency { local-first, coordinated }

  record open-options {
    consistency: consistency,        // по умолчанию local-first
    schema-version: u32,
  }

  resource document {
    get: func(field: string) -> result<option<value>, error>;
    set: func(field: string, v: value) -> result<_, error>;
    delete: func(field: string) -> result<_, error>;
    snapshot: func() -> result<list<tuple<string, value>>, error>;
  }

  resource collection {                 // observed-remove set
    add: func(item: value) -> result<_, error>;
    remove: func(item: value) -> result<_, error>;
    contains: func(item: value) -> result<bool, error>;
    list: func(limit: u32, cursor: option<string>) -> result<page, error>;
  }

  resource counter {
    add: func(delta: s64) -> result<_, error>;
    value: func() -> result<s64, error>;
  }

  resource journal {                    // append-only log
    append: func(payload: list<u8>) -> result<string, error>;
    read: func(from: option<string>, max: u32) -> result<list<entry>, error>;
  }

  resource transaction {
    document: func(key: string) -> result<document, error>;
    collection: func(key: string) -> result<collection, error>;
    commit: func() -> result<_, error>;
    abort: func();
  }

  open-document:   func(ns: namespace, key: string, opts: open-options) -> result<document, error>;
  open-collection: func(ns: namespace, key: string, opts: open-options) -> result<collection, error>;
  open-counter:    func(ns: namespace, key: string, opts: open-options) -> result<counter, error>;
  open-journal:    func(ns: namespace, key: string, opts: open-options) -> result<journal, error>;

  begin: func(ns: namespace) -> result<transaction, error>;

  resource change-feed {
    next: func() -> result<option<change>, error>;
    close: func();
  }
  watch: func(ns: namespace, key-prefix: string) -> result<change-feed, error>;
}
```

Существенные свойства:

- `commit` транзакции атомарно фиксирует изменение и запись для будущей репликации. Отдельного вызова «синхронизировать» не существует и существовать не должно;
- `consistency: coordinated` требует lease и возвращает `unavailable` при отсутствии связи. Молчаливого понижения до `local-first` не происходит;
- `watch` — основной способ построения реактивного UI: изменение с другого устройства приходит тем же каналом, что и локальное;
- `cache` может быть очищен в любой момент; чтение отсутствующего ключа не является ошибкой приложения;
- `tmp` очищается при перезапуске ноды целиком и не участвует в учёте квоты приложения. Данные, которые дорого получить заново, там хранить не следует — для них существует `cache`.

Совместное редактирование текста в v0 отсутствует: для него нужен тип последовательности, вводимый отдельно.

## Настройки — `config.*` — v0

Слоистый вид на `storage.replicated` и `storage.local`, а не отдельное хранилище. Ключи и значения по умолчанию объявляются в манифесте пакета.

```wit
interface config {
  enum layer { default-value, profile, node }

  get:      func(key: string) -> result<option<value>, error>;   // с учётом слоёв
  origin:   func(key: string) -> result<layer, error>;
  set:      func(key: string, v: value) -> result<_, error>;     // слой profile
  set-local: func(key: string, v: value) -> result<_, error>;    // слой node
  clear-local: func(key: string) -> result<_, error>;
  snapshot: func() -> result<list<tuple<string, value>>, error>;

  resource change-feed { next: func() -> result<option<change>, error>; close: func(); }
  watch: func() -> result<change-feed, error>;
}
```

Существенные свойства:

- отдельного права нет: `config` работает поверх уже выданных `storage.replicated.*` и `storage.local.*`. Приложение без права на реплицируемое хранилище получает только слои `default-value` и `node`;
- запись валидируется по схеме из манифеста; значение, не соответствующее схеме, отклоняется, а не сохраняется до первого чтения;
- слой `node` не реплицируется и переживает изменение значения профиля: переопределение на устройстве не сбрасывается при правке общего значения;
- системная оболочка читает схему и значения без запуска приложения, поэтому набор ключей является публичной частью пакета.

## Volumes и учёт места — `files.volumes`, `storage.usage` — v0

```wit
interface volumes {
  enum index-mode { full, members-only }

  record volume {
    id: string,
    path: string,
    members: list<node-id>,
    index: index-mode,
    files: u64,
    bytes: u64,
  }

  list: func() -> result<list<volume>, error>;
  of-path: func(path: string) -> result<option<volume>, error>;
  load-index: func(id: string, deadline-ms: duration-ms) -> result<_, error>;
}

interface usage {
  record entry {
    owner: string,            // user | pkg:<id> | system
    class: string,            // replicated | local | cache | tmp | files | trash | versions
    node: node-id,
    logical-bytes: u64,       // сумма размеров
    stored-bytes: u64,        // занятое место с учётом дедупликации
    staleness-ms: u64,
  }
  own:  func() -> result<list<entry>, error>;          // без дополнительных прав
  all:  func() -> result<list<entry>, error>;          // требует storage.usage
}
```

Существенные свойства:

- создание и изменение volume — действие пользователя в оболочке, а не вызов приложения: приложение может только прочитать состав и запросить загрузку индекса;
- `logical-bytes` и `stored-bytes` возвращаются раздельно, потому что дедупликация чанков делает сумму по владельцам больше физического объёма. Подстановка одного вместо другого даёт неверный ответ на вопрос «сколько освободится»;
- `own` доступен любому пакету и показывает только его собственное потребление.

## Секреты — `secrets.read-write` — v0

```wit
interface secrets {
  record put-options {
    device-bound: bool,       // true = не покидает это устройство
  }
  put:    func(name: string, secret: list<u8>, opts: put-options) -> result<_, error>;
  get:    func(name: string) -> result<option<list<u8>>, error>;
  delete: func(name: string) -> result<_, error>;
  names:  func() -> result<list<string>, error>;
}
```

Секреты не хранятся в manifest и не попадают в журналы. `device-bound: true` соответствует классу `device-bound-secret` и никогда не реплицируется.

## Файлы — `files.app.*`, `files.user.*`, `files.external.<mount>.*` — v0

```wit
interface files {
  enum entry-kind { file, directory }

  enum materialization {
    materialized, metadata-only, fetching, partial, evicted, conflicted, unavailable,
    index-not-local        // каталог: volume в режиме members-only, индекс не загружен
  }

  record stat {
    id: string,               // стабильный идентификатор, не зависит от пути
    name: string,
    kind: entry-kind,
    size: u64,
    modified: instant,
    state: materialization,
    content-hash: option<string>,
  }

  enum access-mode {
    auto,            // при необходимости материализует, ждёт в пределах deadline
    require-local,   // немедленная ошибка, если содержимого нет локально
    stream,          // чтение диапазонов без полной материализации
  }

  resource reader {
    read:  func(max: u32) -> result<list<u8>, error>;
    seek:  func(offset: u64) -> result<_, error>;
    close: func();
  }

  resource writer {
    write:  func(bytes: list<u8>) -> result<u32, error>;
    commit: func() -> result<stat, error>;    // атомарная публикация
    abort:  func();
  }

  open-read:  func(path: string, mode: access-mode) -> result<reader, error>;
  open-write: func(path: string) -> result<writer, error>;

  stat:   func(path: string) -> result<stat, error>;
  list:   func(path: string, limit: u32, cursor: option<string>) -> result<page, error>;
  mkdir:  func(path: string) -> result<_, error>;
  remove: func(path: string, recursive: bool) -> result<_, error>;
  rename: func(from: string, to: string) -> result<_, error>;

  materialize: func(path: string, deadline-ms: duration-ms) -> result<_, error>;
  pin:         func(path: string, recursive: bool) -> result<_, error>;
  unpin:       func(path: string) -> result<_, error>;

  record conflict-version { version-id: string, node: node-id, at: instant, size: u64 }
  conflicts: func(path: string) -> result<list<conflict-version>, error>;
  resolve:   func(path: string, keep: string) -> result<_, error>;

  resource change-feed { next: func() -> result<option<change>, error>; close: func(); }
  watch: func(path: string, recursive: bool) -> result<change-feed, error>;
}
```

Существенные свойства:

- `commit` публикует файл атомарно: частично записанный файл не наблюдаем;
- `rename` — операция над метаданными, идентификатор файла сохраняется;
- `state` возвращается всегда, и приложение обязано его учитывать. Предположение «файл виден в списке, значит содержимое доступно» неверно;
- ограничения на имена — объединение ограничений всех целевых платформ, проверяются при записи;
- внешние монтирования адресуются как `/mnt/<mount-id>/...` и требуют собственного права. Платформа может отозвать доступ в любой момент, что возвращается как `revoked`, а не `io`.
