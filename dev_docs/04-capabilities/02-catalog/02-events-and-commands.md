# Каталог: события и команды

Статус: design document, версия каталога `0.1`  
Назначение: события и вызов команд между компонентами и пакетами.

Смежные документы: [правила каталога](./00-index.md), [общие типы](./01-common-types.md), [шина событий](../../03-apps/10-events-and-push.md).

## События — `events.subscribe`, `events.publish` — v0

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

## Команды — `command.invoke` — v0, делегируемо

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

При указании `node` вызов становится удалённым со всеми следствиями [удалённого вызова](./00-index.md).
