# Каталог: сеть

Статус: design document, версия каталога `0.1`  
Назначение: исходящие запросы, экспорт API приложения и слушающие сокеты.

Смежные документы: [правила каталога](./00-index.md), [общие типы](./01-common-types.md), [базовый стек](../../02-architecture/06-base-stack.md).

## HTTP — `net.http:<host>` — v0, делегируемо

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

## WebSocket — `net.ws:<host>` — v0

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

## Экспорт API приложения — `api.export`, `api.call:<service>` — v0, делегируемо

Основной способ для приложения принять запрос извне. Реального порта не открывается: вызов
идёт по уже установленной аутентифицированной сессии между нодами, поэтому механизм работает
за NAT, в сотовой сети и на Android. Вертикальный разбор — в
[базовом стеке](../../02-architecture/06-base-stack.md).

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

## Слушающий сокет — `net.listen:<port>` — v0

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

## Брокер сообщений — `mqtt.connect` — позже

```wit
interface messaging {
  record subscribe-options { qos: u8, durable: bool }
  subscribe:   func(broker: string, topic: string, opts: subscribe-options) -> result<string, error>;
  unsubscribe: func(subscription-id: string) -> result<_, error>;
  publish:     func(broker: string, topic: string, payload: list<u8>, qos: u8) -> result<_, error>;
}
```

Подписка переживает завершение worker: соединение удерживает системный service, входящие сообщения сохраняются и доставляются как события активации. Это способ реализовать сценарии, для которых в других системах заводят daemon.

## Сокеты — `net.socket.tcp`, `net.socket.udp` — позже

Низкоуровневый доступ вводится после стабилизации HTTP и WebSocket. Контракт: `connect`, `listen`, `accept` с `byte-reader` и `byte-writer`, право ограничивается хостом и диапазоном портов. На Android действуют ограничения фонового режима.
