# Каталог capabilities K-OS

Статус: design document, версия каталога `0.1`  
Назначение: единый источник истины для публичного API K-OS.

Из этого документа выводятся:

- WIT-интерфейсы для WebAssembly workers;
- TypeScript SDK для Web UI;
- имена прав в manifest пакета;
- контракты host adapters и их mock-реализаций;
- contract tests, общие для всех платформ.

Смежные документы: [карте документов](../README.md) — слои и модель прав; [карте документов](../README.md) — механизмы репликации и удалённого исполнения.

Правило: если сигнатура в другом документе расходится с этим — верен этот документ.

## Нотация

Интерфейсы записаны в синтаксисе WIT, поскольку WebAssembly Component Model является целевым форматом для workers. TypeScript SDK генерируется из тех же определений и повторяет их семантику, отличаясь только идиоматикой языка.

Записи в каталоге сокращены до значимой части: опущены очевидные варианты полей и повторяющиеся типы. Полные `.wit` файлы находятся в `crates/contracts` и являются машиночитаемой формой этого документа.

## Правила каталога

### Именование

```text
capability:  <домен>.<область>.<операция>
интерфейс:   kos:<домен>/<интерфейс>@<версия>
```

Домены: `core`, `storage`, `fs`, `net`, `media`, `vcs`, `system`, `hw`, `runtime`.

Право может иметь **scope**, ограничивающий область действия: хост для HTTP, идентификатор монтирования для внешних файлов, имя программы для запуска процессов, список команд для их вызова.

```text
net.http:api.example.com
files.external.photos-drive.read
process.exec:git
command.invoke  scope = ["scan-library"]
```

### Версионирование

Каждый интерфейс версионируется по semver. Пакет объявляет требуемый диапазон:

```toml
[[components.capabilities]]
name = "storage.replicated.read-write"
version = "^1"
```

- **patch** — исправление формулировки без изменения поведения;
- **minor** — добавление метода, поля с значением по умолчанию, варианта ошибки, помеченного как расширяемый;
- **major** — всё остальное, включая изменение семантики существующего метода.

Runtime может предоставлять несколько major-версий интерфейса одновременно. Удаление major-версии требует объявленного периода устаревания.

### Доступность

Отсутствие возможности на конкретном node — нормальное состояние, а не ошибка реализации.

```text
granted + available     вызов выполняется
granted + unavailable   error::unavailable с причиной
not granted             error::denied
```

Приложение может заранее узнать состояние:

```wit
interface capabilities {
  enum availability { available, unavailable, denied }
  record capability-state {
    name: string,
    version: string,
    state: availability,
    reason: option<string>,
    remote-nodes: list<node-id>,   // где доступно, если недоступно здесь
  }
  query: func(names: list<string>) -> list<capability-state>;
}
```

Поле `remote-nodes` существенно: оно позволяет UI предложить выполнить операцию на другом устройстве вместо сообщения об ошибке.

Молчаливая деградация запрещена. Реализация не имеет права подменять недоступную возможность приблизительным аналогом без явного запроса приложения.

### Handles

Всё, что владеет ресурсом, выражается через `resource` — непрозрачный handle с деструктором.

Свойства handle:

- привязан к выдавшему его execution и его правам;
- отзывается при завершении владельца, отзыве права и смене сессии;
- не передаётся другому пакету иначе как через явный системный механизм;
- освобождение идемпотентно;
- использование отозванного handle возвращает `error::revoked`.

### Потоки

Потоки выражаются через `resource` с явными `read`/`write`, а не через типы потоков языка, поскольку стабильного переносимого представления потока в Component Model пока нет.

```wit
resource byte-reader {
  read: func(max: u32) -> result<list<u8>, error>;   // пустой список = конец
  close: func();
}

resource byte-writer {
  write: func(bytes: list<u8>) -> result<u32, error>;
  flush: func() -> result<_, error>;
  close: func() -> result<_, error>;
}
```

`write` возвращает число принятых байт: это выражение backpressure. Реализация не имеет права буферизовать неограниченно.

При появлении стабильного потокового типа он заменит эти ресурсы в новой major-версии.

### Отмена и deadline

У каждого execution есть deadline и признак отмены. Долгие операции обязаны их учитывать.

```wit
interface execution {
  deadline: func() -> option<instant>;
  cancelled: func() -> bool;
  on-cancel-checkpoint: func(state: list<u8>) -> result<_, error>;
}
```

Worker обязан периодически проверять `cancelled` или использовать операции, прерываемые по deadline. Runtime вправе прервать исполнение принудительно; подтверждённое состояние при этом не должно повреждаться.

### Квоты

Права определяют доступ, квоты — объём использования. Это разные механизмы, и оба применяются runtime.

Квотируются: объём хранилища, число одновременных соединений и handles, исходящий трафик, время CPU, частота активации, число фоновых задач.

Превышение возвращает `error::quota-exceeded` с указанием ресурса и времени восстановления. Квота не является правом и не объявляется в manifest.

### Удалённый вызов

Любой вызов, помеченный в каталоге как делегируемый, может быть исполнен на другом node профиля. Семантика удалённого вызова описана в сетевом документе; для приложения существенно, что появляются дополнительные ошибки `unreachable`, `deadline-exceeded` и `result-unknown`, и что операция должна быть идемпотентной либо иметь ключ дедупликации.

## Общие типы

```wit
package kos:core@0.1.0;

interface types {
  type profile-id = string;
  type node-id = string;
  type package-id = string;
  type component-id = string;
  type execution-id = string;
  type trace-id = string;

  type instant = u64;        // миллисекунды настенных часов, только для отображения
  type duration-ms = u64;

  variant value {
    null,
    bool(bool),
    int(s64),
    float(f64),
    text(string),
    bytes(list<u8>),
    json(string),
  }
}
```

### Ошибки

Единая таксономия для всех интерфейсов:

```wit
variant error {
  denied(denied-info),           // право не выдано
  unavailable(unavailable-info), // возможности нет на этом node
  revoked,                       // handle или право отозваны
  not-found,
  already-exists,
  invalid-argument(string),
  precondition-failed(string),
  conflict(conflict-info),       // параллельное изменение
  quota-exceeded(quota-info),
  deadline-exceeded,
  cancelled,
  unreachable(node-id),          // удалённый вызов
  result-unknown,                // исход удалённой операции неизвестен
  io(string),
  internal(string),
}

record denied-info      { capability: string, scope: option<string> }
record unavailable-info { reason: string, remote-nodes: list<node-id> }
record quota-info       { resource: string, retry-after-ms: option<u64> }
record conflict-info    { object: string, versions: list<string> }
```

`result-unknown` не является исключительной ситуацией. Код, вызывающий делегируемые операции, обязан её обрабатывать.

### Контекст вызова

```wit
interface context {
  record caller {
    profile: profile-id,
    node: node-id,
    package: package-id,
    component: component-id,
    execution: execution-id,
    trace: trace-id,
  }
  current: func() -> caller;
}
```

Контекст доступен для чтения, но не задаётся приложением. Runtime восстанавливает его из сессии контейнера или экземпляра worker.

### Время

```wit
interface clock {
  now: func() -> instant;              // настенные часы, для отображения
  monotonic: func() -> duration-ms;    // для измерения интервалов
  timezone: func() -> string;          // IANA
  sleep: func(d: duration-ms) -> result<_, error>;
}
```

Право не требуется. Ограничение относится к реализации: любой код ядра и приложений получает время только отсюда, что делает возможной детерминированную симуляцию.

`now` не определяет порядок операций. Для причинности используются механизмы уровня хранилища, а не эти значения.

### Журналирование

```wit
interface log {
  enum level { trace, debug, info, warn, error }
  write: func(lvl: level, message: string, fields: list<tuple<string, value>>);
}
```

Право не требуется, объём квотируется. Значения, помеченные как секреты, редактируются runtime перед записью.

## Каталог

Обозначения в заголовках: **v0** — входит в первую версию; **позже** — контракт зафиксирован, реализация отложена. Столбец «делегируемо» означает возможность исполнения на другом node.

### События — `events.subscribe`, `events.publish` — v0

```wit
interface events {
  record event {
    topic: string,
    payload: list<u8>,
    source: option<node-id>,
    at: instant,
  }

  resource subscription {
    next: func() -> result<option<event>, error>;   // none = подписка закрыта
    close: func();
  }

  subscribe: func(topic-pattern: string) -> result<subscription, error>;
  publish: func(topic: string, payload: list<u8>) -> result<_, error>;
}
```

Пространство тем:

```text
app:<package-id>/<...>   темы приложения, публикация только своим пакетом
sys:<...>                системные темы, только чтение
```

Событие может активировать worker, объявивший тему в `activation`. Доставка — at-least-once, обработчик обязан быть идемпотентным.

### Команды — `command.invoke` — v0, делегируемо

```wit
interface commands {
  record invoke-options {
    deadline-ms: option<duration-ms>,
    node: option<node-id>,          // явный выбор узла исполнения
    idempotency-key: option<string>,
  }
  invoke: func(target: string, payload: list<u8>, opts: invoke-options)
    -> result<list<u8>, error>;
}
```

`target` — идентификатор команды внутри пакета либо `<package-id>:<command-id>` для межпакетного вызова. Межпакетный вызов требует согласия обеих сторон: вызывающий объявляет право, вызываемый — что команда экспортируется.

При указании `node` вызов становится удалённым со всеми следствиями раздела 2.8.

### Хранилище — `storage.local.*`, `storage.replicated.*`, `storage.cache.*` — v0

Приложение выбирает семантику данных, а не алгоритм репликации.

```wit
interface store {
  enum namespace { local, replicated, cache }
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
- `cache` может быть очищен в любой момент; чтение отсутствующего ключа не является ошибкой приложения.

Совместное редактирование текста в v0 отсутствует: для него нужен тип последовательности, вводимый отдельно.

### Секреты — `secrets.read-write` — v0

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

### Файлы — `files.app.*`, `files.user.*`, `files.external.<mount>.*` — v0

```wit
interface files {
  enum entry-kind { file, directory }

  enum materialization {
    materialized, metadata-only, fetching, partial, evicted, conflicted, unavailable
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

### HTTP — `net.http:<host>` — v0, делегируемо

```wit
interface http {
  record request {
    method: string,
    url: string,
    headers: list<tuple<string, string>>,
    body: option<list<u8>>,
    timeout-ms: option<duration-ms>,
    follow-redirects: bool,
  }
  record response {
    status: u16,
    headers: list<tuple<string, string>>,
  }
  resource exchange {
    response: func() -> result<response, error>;
    body: func() -> result<byte-reader, error>;
  }
  send:        func(req: request) -> result<exchange, error>;
  send-stream: func(req: request, body: byte-reader) -> result<exchange, error>;
}
```

Право выдаётся по хосту. Редирект на хост, не покрытый правом, не выполняется автоматически: runtime проверяет каждый переход и возвращает `denied` с указанием целевого хоста.

### WebSocket — `net.ws:<host>` — v0

```wit
interface websocket {
  variant message { text(string), binary(list<u8>), closed(u16) }
  resource connection {
    send:    func(msg: message) -> result<_, error>;
    receive: func() -> result<option<message>, error>;
    close:   func(code: u16) -> result<_, error>;
  }
  connect: func(url: string, protocols: list<string>) -> result<connection, error>;
}
```

Ограничение жизненного цикла: соединение принадлежит вызвавшему execution. Worker, завершившийся после обработки события, теряет соединение. Постоянные подписки строятся не здесь, а через системный брокер сообщений, который удерживает соединение и активирует worker событием.

### Экспорт API приложения — `api.export`, `api.call:<service>` — v0, делегируемо

Основной способ для приложения принять запрос извне. Реального порта не открывается: вызов
идёт по уже установленной аутентифицированной сессии между нодами, поэтому механизм работает
за NAT, в сотовой сети и на Android. Вертикальный разбор — в
[базовом стеке](../02-architecture/12-base-stack.md).

```wit
interface api-export {
  enum audience {
    profile-nodes,     // ноды своего профиля
    linked-users,      // связанные пользователи, в пределах выданного им доступа
    local-packages,    // другие пакеты на этой же ноде
  }

  record exported-method {
    name: string,
    request-schema: string,      // идентификатор схемы, а не произвольный blob
    response-schema: string,
    audience: audience,
    idempotent: bool,
  }

  record call-context {
    caller: caller,              // profile, node, package, component
    audience: audience,
    deadline-ms: duration-ms,
  }

  export:   func(service: string, methods: list<exported-method>) -> result<_, error>;
  unexport: func(service: string) -> result<_, error>;
}

interface api-call {
  record call-options {
    deadline-ms: duration-ms,
    idempotency-key: option<string>,
  }

  // конкретная нода: важен ресурс именно этого устройства
  call: func(target: node-id, service: string, method: string,
             payload: list<u8>, opts: call-options) -> result<list<u8>, error>;

  // любая нода профиля, где сервис доступен
  call-profile: func(service: string, method: string,
                     payload: list<u8>, opts: call-options) -> result<list<u8>, error>;

  // сеть связанного пользователя, если он выдал доступ
  call-linked: func(peer: profile-id, service: string, method: string,
                    payload: list<u8>, opts: call-options) -> result<list<u8>, error>;
}
```

Существенные свойства:

- **идентичность вызывающего не передаётся приложением.** `call-context.caller`
  восстанавливается из аутентифицированной сессии ноды и delegation-токена; подделать его
  содержимым запроса невозможно;
- **экспорт объявляется в манифесте** вместе с аудиторией каждого метода. Вызов метода,
  чья аудитория не покрывает вызывающего, возвращает `denied` и не доходит до обработчика;
- **обработчик активируется по вызову.** Постоянно работающий компонент не требуется:
  входящий вызов является событием активации worker;
- **проверка двусторонняя.** У вызывающего должно быть право `api.call:<service>`,
  у принимающей ноды — собственное правило, разрешающее обслуживать этот вызов здесь;
- `call` и `call-profile` возвращают полный набор ошибок удалённого вызова, включая
  `unreachable` и `result-unknown`; метод, помеченный `idempotent = false`, не повторяется
  системой автоматически.

### Слушающий сокет — `net.listen:<port>` — v0

Отдельная от экспорта API возможность: настоящий TCP-порт на этой ноде для клиентов, ничего
не знающих о K-OS. Право привязано к ноде, а не к профилю, потому что порт — ресурс
конкретного устройства.

```wit
interface listener {
  enum scope { loopback, local-network, any }

  record listen-opts {
    scope: scope,                    // по умолчанию loopback
    max-connections: u32,
    tls: option<tls-config>,
  }

  record peer-info { address: string, port: u16, tls: bool }

  // HTTP-сервер: обработчик регистрируется на путь
  record server-request {
    method: string,
    path: string,
    headers: list<tuple<string, string>>,
    peer: peer-info,
  }
  resource server-exchange {
    request: func() -> server-request;
    body:    func() -> result<byte-reader, error>;
    respond: func(status: u16, headers: list<tuple<string, string>>) -> result<byte-writer, error>;
  }
  resource http-acceptor {
    accept: func() -> result<option<server-exchange>, error>;
    close:  func();
  }
  serve-http: func(port: u16, opts: listen-opts) -> result<http-acceptor, error>;

  // WebSocket-сервер поверх того же права
  resource session {
    send:    func(msg: message) -> result<_, error>;
    receive: func() -> result<option<message>, error>;
    close:   func(code: u16) -> result<_, error>;
    peer:    func() -> peer-info;
  }
  resource ws-acceptor {
    accept: func() -> result<option<session>, error>;
    close:  func();
  }
  serve-ws: func(port: u16, path: string, opts: listen-opts) -> result<ws-acceptor, error>;
}
```

Ограничения:

- порты ниже 1024 приложениям не выдаются;
- `scope` по умолчанию `loopback`; `local-network` и `any` требуют отдельного подтверждения
  пользователя, поскольку делают приложение доступным другим устройствам сети;
- acceptor принадлежит вызвавшему execution: остановка компонента закрывает слушателя, и
  долгоживущий приём соединений не является возможностью пользовательского кода;
- число одновременных соединений и частота их приёма квотируются;
- на Android возможность ограничена платформой и в фоне возвращает `unavailable`;
- внешний клиент не считается доверенным: его аутентификация — задача приложения;
- система не открывает порт наружу через маршрутизатор; достижимость извне — решение
  пользователя на уровне сети.

### Брокер сообщений — `mqtt.connect` — позже

```wit
interface messaging {
  record subscribe-options { qos: u8, durable: bool }
  subscribe:   func(broker: string, topic: string, opts: subscribe-options) -> result<string, error>;
  unsubscribe: func(subscription-id: string) -> result<_, error>;
  publish:     func(broker: string, topic: string, payload: list<u8>, qos: u8) -> result<_, error>;
}
```

Подписка переживает завершение worker: соединение удерживает системный service, входящие сообщения сохраняются и доставляются как события активации. Это способ реализовать сценарии, для которых в других системах заводят daemon.

### Сокеты — `net.socket.tcp`, `net.socket.udp` — позже

Низкоуровневый доступ вводится после стабилизации HTTP и WebSocket. Контракт: `connect`, `listen`, `accept` с `byte-reader` и `byte-writer`, право ограничивается хостом и диапазоном портов. На Android действуют ограничения фонового режима.

### Медиа — `media.probe`, `media.transcode`, `media.capture` — v0 кроме capture

Реализуется несколькими взаимозаменяемыми backends: библиотека в процессе, поставляемый бинарь, удалённое исполнение.

```wit
interface media {
  record media-info {
    container: string,
    duration-ms: u64,
    streams: list<stream-info>,
    tags: list<tuple<string, string>>,
  }
  probe: func(path: string) -> result<media-info, error>;

  record video-target { codec: string, width: option<u32>, height: option<u32>, bitrate: option<u32>, fps: option<f32> }
  record audio-target { codec: string, bitrate: option<u32>, channels: option<u8>, sample-rate: option<u32> }
  record transcode-request {
    input: string,
    output: string,
    container: string,
    video: option<video-target>,
    audio: option<audio-target>,
    trim-start-ms: option<u64>,
    trim-end-ms: option<u64>,
  }

  resource job {
    progress: func() -> result<f32, error>;
    await-result: func() -> result<stat, error>;
    cancel: func();
  }
  transcode: func(req: transcode-request) -> result<job, error>;

  record backend-info {
    kind: string,                  // library | bundled | remote
    node: node-id,
    containers: list<string>,
    video-codecs: list<string>,
    audio-codecs: list<string>,
    hardware-acceleration: bool,
  }
  backend: func() -> result<backend-info, error>;
}
```

`backend()` обязателен к использованию перед построением запроса: набор кодеков различается между платформами, и приложение должно выбирать поддерживаемый вариант, а не получать ошибку в середине длинной операции.

Передача произвольных аргументов внешнему инструменту выделена в отдельное право `media.raw-args`, не входит в v0 и не переносима между платформами.

### Git — `vcs.git` — v0

Реализуется библиотекой в процессе, что делает возможной работу на Android без запуска процессов.

```wit
interface git {
  record signature { name: string, email: string }
  record commit-info { id: string, message: string, author: signature, at: instant }

  resource repo {
    status:   func() -> result<list<file-status>, error>;
    stage:    func(paths: list<string>) -> result<_, error>;
    commit:   func(message: string, author: signature) -> result<string, error>;
    log:      func(limit: u32) -> result<list<commit-info>, error>;
    branches: func() -> result<list<string>, error>;
    checkout: func(reference: string) -> result<_, error>;
    fetch:    func(remote: string) -> result<_, error>;
    pull:     func(remote: string, branch: string) -> result<_, error>;
    push:     func(remote: string, branch: string) -> result<_, error>;
  }

  open:  func(path: string) -> result<repo, error>;
  init:  func(path: string) -> result<repo, error>;
  clone: func(url: string, path: string) -> result<repo, error>;
}
```

Сетевые операции требуют дополнительно права на соответствующий хост, а учётные данные берутся из secrets service, а не передаются приложением в открытом виде.

Экзотические возможности Git, отсутствующие в библиотечной реализации, в переносимый контракт не входят.

### Сведения о системе — `system.info`, `system.info.detailed` — v0

```wit
interface system-info {
  record basic {
    os: string,                    // linux | windows | android
    os-version: string,
    arch: string,
    node-role: string,             // device | cloud
    form-factor: string,           // desktop | mobile | headless
    cpu-cores: u32,
    memory-total: u64,
    memory-available: u64,
    battery: option<battery-info>,
    power-source: string,          // ac | battery | unknown
    network: network-status,       // тип подключения, metered
    locale: string,
    timezone: string,
    screen: option<screen-info>,
  }
  record detailed {
    hostname: string,
    machine-id: string,
    uptime-ms: u64,
    load-average: list<f32>,
    volumes: list<volume-info>,
    interfaces: list<interface-info>,
    thermal: option<thermal-info>,
  }
  get-basic:    func() -> basic;
  get-detailed: func() -> result<detailed, error>;
}
```

Разделение обусловлено фингерпринтингом: `basic` нужен почти каждому приложению для адаптации UI и решения о тяжёлых операциях, `detailed` содержит стабильные идентификаторы устройства и выдаётся отдельно.

### Питание — `system.power` — v0, класс администрирования

```wit
interface power {
  enum action { reboot, shutdown, suspend, cancel-pending }
  record options { delay-ms: option<duration-ms>, reason: string }
  request: func(a: action, opts: options) -> result<_, error>;
  can:     func(a: action) -> bool;
}
```

Обычным приложениям не выдаётся. На Android возвращает `unavailable`. На Linux и Windows может требовать эскалации прав в ОС, что выражается как `denied` с указанием причины.

### Процессы хоста — `process.exec:<program>`, `process.shell` — v0, класс администрирования, делегируемо

```wit
interface process {
  enum stdio { inherit-null, pipe }
  record spawn-options {
    program: string,
    args: list<string>,                        // отдельными элементами, не строкой
    env: list<tuple<string, string>>,          // явный список, наследования нет
    cwd: string,                               // путь VFS или внешнего монтирования
    stdin: stdio,
    stdout: stdio,
    stderr: stdio,
    timeout-ms: duration-ms,                   // обязателен
  }
  record exit-status { code: option<s32>, signal: option<s32>, timed-out: bool }

  resource child {
    stdin:  func() -> result<byte-writer, error>;
    stdout: func() -> result<byte-reader, error>;
    stderr: func() -> result<byte-reader, error>;
    wait:   func() -> result<exit-status, error>;
    kill:   func() -> result<_, error>;
  }

  spawn: func(opts: spawn-options) -> result<child, error>;

  record shell-options { command: string, cwd: string, timeout-ms: duration-ms }
  shell: func(opts: shell-options) -> result<child, error>;

  record shell-info { available: bool, kind: string }   // sh | cmd | powershell
  shell-kind: func() -> shell-info;
}
```

- `spawn` с массивом аргументов не подвержен инъекции и является переносимым способом;
- `shell` исполняет строку через оболочку хоста, платформозависим и требует отдельного права. `shell-kind` возвращает вид оболочки, различие не скрывается;
- окружение не наследуется; `cwd` обязан находиться внутри доступного компоненту поддерева;
- отмена execution завершает дочерний процесс и его группу;
- на Android оба метода возвращают `unavailable` для произвольных программ.

При удалённом исполнении право проверяется дважды: у инициатора — право делегировать, у целевого node — собственное правило для этого пакета и этой программы.

### GPIO — `gpio.line` — v0 на Linux

Поставляется сборочной feature платформенного crate либо отдельным platform extension package.

```wit
interface gpio {
  enum direction { input, output }
  enum edge { none, rising, falling, both }
  enum bias { disabled, pull-up, pull-down }

  record line-options { direction: direction, bias: bias, edge: edge, active-low: bool }

  resource line {
    read:  func() -> result<bool, error>;
    write: func(v: bool) -> result<_, error>;
    wait-edge: func(timeout-ms: duration-ms) -> result<option<edge-event>, error>;
  }

  record chip-info { name: string, label: string, lines: u32 }
  list-chips: func() -> result<list<chip-info>, error>;
  open-line:  func(chip: string, offset: u32, opts: line-options) -> result<line, error>;
}
```

Типовой сценарий — удалённый: UI на телефоне управляет линией на Linux-ноде. Поэтому `gpio` помечен как делегируемый, а `capabilities.query` возвращает список узлов, где он доступен.

### Последовательный порт — `serial.port` — позже

Контракт: перечисление портов, открытие с параметрами скорости и чётности, `byte-reader` и `byte-writer`. На Android требует разрешения USB-хоста и подтверждения пользователя для конкретного устройства.

### Планировщик и фоновая работа — `background.run` — v0

```wit
interface scheduler {
  variant schedule-spec {
    interval(duration-ms),
    civil(civil-schedule),        // гражданское время + IANA timezone
  }
  record civil-schedule { expression: string, timezone: string }

  record job-options {
    scope: string,                // per-view | per-node | per-user | cluster-singleton
    idempotency-key: option<string>,
    requires: list<string>,       // необходимые capabilities
    prefers: list<string>,
    remote: bool,
  }

  schedule: func(id: string, spec: schedule-spec, opts: job-options) -> result<_, error>;
  cancel:   func(id: string) -> result<_, error>;
  enqueue:  func(payload: list<u8>, opts: job-options) -> result<string, error>;

  record lease-request { duration-ms: duration-ms, reason: string }
  resource lease {
    remaining-ms:  func() -> duration-ms;
    fencing-token: func() -> u64;
    renew:   func(d: duration-ms) -> result<_, error>;
    release: func();
  }
  request-lease: func(req: lease-request) -> result<lease, error>;

  checkpoint:      func(state: list<u8>) -> result<_, error>;
  load-checkpoint: func() -> result<option<list<u8>>, error>;
}
```

- расписание хранится в гражданском времени с timezone и вычисляется исполняющим узлом;
- задача scope `per-user` дедуплицируется по ключу срабатывания, иначе выполнится на каждом устройстве;
- lease выражает разрешение и запрошенный бюджет, но не обещание запуска в точный момент;
- `fencing-token` обязателен при защите внешнего эффекта: истечение lease само по себе не останавливает прежнего владельца.

### Уведомления — `notifications.show` — v0

```wit
interface notifications {
  record action { id: string, label: string }
  record notification {
    id: string,
    title: string,
    body: string,
    actions: list<action>,
    urgency: string,              // low | normal | high
    silent: bool,
  }
  show:   func(n: notification) -> result<_, error>;
  update: func(n: notification) -> result<_, error>;
  cancel: func(id: string) -> result<_, error>;
}
```

Нажатие на действие доставляется как событие активации, поэтому уведомление может обработать worker без открытого UI. Поведение и гарантии доставки различаются между платформами и не выравниваются искусственно.

### Узлы профиля — `nodes.read` — v0

```wit
interface nodes {
  record descriptor {
    id: node-id,
    name: string,
    role: string,                 // device | cloud | relay
    platform: string,
    online: bool,
    last-seen: instant,
    capabilities: list<string>,
    power-source: string,
    metered: bool,
    staleness-ms: u64,            // давность сведений
  }
  current: func() -> descriptor;
  list:    func() -> result<list<descriptor>, error>;
}
```

Сведения могут быть устаревшими, поэтому `staleness-ms` возвращается всегда. Приложение не должно считать список актуальным на момент вызова.

### Удалённое исполнение — `remote.delegate` — v0

```wit
interface remote {
  record delegation-request {
    target-node: node-id,
    capability: string,
    scope: option<string>,
    deadline-ms: duration-ms,
    transferable: bool,           // по умолчанию false
  }
  resource delegation {
    token: func() -> string;
    revoke: func();
  }
  delegate: func(req: delegation-request) -> result<delegation, error>;

  invoke-on: func(node: node-id, target: string, payload: list<u8>,
                  opts: invoke-options) -> result<list<u8>, error>;
}
```

Целевой node проверяет и валидность делегирования, и собственное правило для этого пакета. Односторонней проверки недостаточно.

## Сводная таблица

Доступность: `+` реализуется, `−` возвращает `unavailable`, `?` зависит от сборки или расширения.

| Capability | Интерфейс | Версия | Статус | Linux | Windows | Android | Cloud | Делегируемо |
|---|---|---|---|---|---|---|---|---|
| `events.subscribe` / `events.publish` | `core/events` | 1.0 | v0 | + | + | + | + | нет |
| `command.invoke` | `core/commands` | 1.0 | v0 | + | + | + | + | да |
| `storage.local.read-write` | `storage/store` | 1.0 | v0 | + | + | + | + | нет |
| `storage.replicated.read-write` | `storage/store` | 1.0 | v0 | + | + | + | + | нет |
| `storage.cache.read-write` | `storage/store` | 1.0 | v0 | + | + | + | + | нет |
| `secrets.read-write` | `storage/secrets` | 1.0 | v0 | + | + | + | + | нет |
| `files.app.read-write` | `fs/files` | 1.0 | v0 | + | + | + | + | нет |
| `files.user.read` / `.write` | `fs/files` | 1.0 | v0 | + | + | + | + | нет |
| `files.external.<mount>.*` | `fs/files` | 1.0 | v0 | + | + | ? | + | нет |
| `net.http:<host>` | `net/http` | 1.0 | v0 | + | + | + | + | да |
| `net.ws:<host>` | `net/websocket` | 1.0 | v0 | + | + | + | + | нет |
| `api.export` | `net/api-export` | 1.0 | v0 | + | + | + | + | — |
| `api.call:<service>` | `net/api-call` | 1.0 | v0 | + | + | + | + | да |
| `net.listen:<port>` | `net/listener` | 1.0 | v0 | + | + | ? | + | нет |
| `mqtt.connect` | `net/messaging` | 0.1 | позже | + | + | + | + | нет |
| `net.socket.tcp` / `.udp` | `net/sockets` | 0.1 | позже | + | + | ? | + | да |
| `media.probe` / `media.transcode` | `media/media` | 1.0 | v0 | + | + | + | + | да |
| `media.capture` | `media/capture` | 0.1 | позже | + | + | + | − | нет |
| `vcs.git` | `vcs/git` | 1.0 | v0 | + | + | + | + | да |
| `system.info` | `system/system-info` | 1.0 | v0 | + | + | + | + | нет |
| `system.info.detailed` | `system/system-info` | 1.0 | v0 | + | + | + | + | нет |
| `system.power` | `system/power` | 1.0 | v0 | + | + | − | + | да |
| `process.exec:<program>` | `system/process` | 1.0 | v0 | + | + | − | + | да |
| `process.shell` | `system/process` | 1.0 | v0 | + | + | − | + | да |
| `gpio.line` | `hw/gpio` | 1.0 | v0 | ? | − | − | − | да |
| `serial.port` | `hw/serial` | 0.1 | позже | ? | ? | ? | ? | да |
| `background.run` | `runtime/scheduler` | 1.0 | v0 | + | + | + | + | нет |
| `notifications.show` | `runtime/notifications` | 1.0 | v0 | + | + | + | − | нет |
| `nodes.read` | `runtime/nodes` | 1.0 | v0 | + | + | + | + | нет |
| `remote.delegate` | `runtime/remote` | 1.0 | v0 | + | + | + | + | — |

Интерфейсы `core/types`, `core/context`, `core/clock`, `core/log` и `core/capabilities` доступны без объявления права.

## Правила изменения каталога

1. Изменение начинается с этого документа, затем меняется `.wit`, затем генерируются SDK и mock-реализации. Обратный порядок запрещён: расхождение обнаруживается слишком поздно.
2. Добавление capability требует ответа на пять вопросов: какое право, какой scope, что возвращается при недоступности, делегируется ли, как квотируется.
3. Каждый новый интерфейс сопровождается contract test, запускаемым против всех реализаций, включая mock. Реализация без mock не принимается.
4. Расширение существующего интерфейса без изменения major-версии допустимо только добавлением; удаление и изменение семантики требуют новой major-версии и периода устаревания.
5. Право не считается введённым, пока в системной оболочке нет диалога его выдачи с понятной пользователю формулировкой.

## Что не входит в версию 0.1

- совместное редактирование текста как тип реплицируемых данных;
- произвольные аргументы внешних инструментов;
- низкоуровневые сокеты и последовательные порты;
- захват медиа;
- USB, NFC, камера и датчики;
- межпакетный обмен потоками данных сверх `command.invoke`;
- публикация приложением системных тем событий;
- интерфейсы управления самим профилем: добавление и отзыв устройств выполняются только системной оболочкой.
