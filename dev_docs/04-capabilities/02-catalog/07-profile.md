# Каталог: узлы профиля и удалённое исполнение

Статус: design document, версия каталога `0.1`  
Назначение: чтение состава профиля и делегирование вызовов другим узлам.

Смежные документы: [правила каталога](./00-index.md), [общие типы](./01-common-types.md), [удалённые вызовы](../../06-network/06-rpc-and-delegation.md).

## Узлы профиля — `nodes.read` — v0

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

## Удалённое исполнение — `remote.delegate` — v0

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
