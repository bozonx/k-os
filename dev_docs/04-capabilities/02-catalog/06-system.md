# Каталог: система, фоновая работа и оборудование

Статус: design document, версия каталога `0.1`  
Назначение: сведения о системе, питание, планировщик, уведомления и линии оборудования.

Смежные документы: [правила каталога](./00-index.md), [общие типы](./01-common-types.md), [фоновая работа](../../03-apps/03-lifecycle.md).

## Сведения о системе — `system.info`, `system.info.detailed` — v0

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

## Питание — `system.power` — v0, класс администрирования

```wit
interface power {
  enum action { reboot, shutdown, suspend, cancel-pending }
  record options { delay-ms: option<duration-ms>, reason: string }
  request: func(a: action, opts: options) -> result<_, error>;
  can:     func(a: action) -> bool;
}
```

Обычным приложениям не выдаётся. На Android возвращает `unavailable`. На Linux и Windows может требовать эскалации прав в ОС, что выражается как `denied` с указанием причины.


## Планировщик и фоновая работа — `background.run` — v0

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

## Уведомления — `notifications.show` — v0

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


## GPIO — `gpio.line` — v0 на Linux

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

## Последовательный порт — `serial.port` — позже

Контракт: перечисление портов, открытие с параметрами скорости и чётности, `byte-reader` и `byte-writer`. На Android требует разрешения USB-хоста и подтверждения пользователя для конкретного устройства.
