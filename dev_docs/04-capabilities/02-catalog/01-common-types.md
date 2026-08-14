# Каталог: общие типы

Статус: design document, версия каталога `0.1`  
Назначение: типы, ошибки, контекст вызова, время и журналирование, общие для всех интерфейсов каталога.

Смежные документы: [правила каталога](./00-index.md), [ошибки и наблюдаемость](../../02-architecture/05-services.md).

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

## Ошибки

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

## Контекст вызова

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

## Время

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

## Журналирование

```wit
interface log {
  enum level { trace, debug, info, warn, error }
  write: func(lvl: level, message: string, fields: list<tuple<string, value>>);
}
```

Право не требуется, объём квотируется. Значения, помеченные как секреты, редактируются runtime перед записью.
