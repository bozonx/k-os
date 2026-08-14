# Манифест пакета

Статус: перенесено из прежних документов, требует ревизии.  
Назначение: зафиксировать состав манифеста: компоненты, объявление прав, placement, активацию и совместимость.

Связанные документы: [модель приложения](./01-app-model.md), [модель capabilities](../04-capabilities/01-model.md), [каталог capabilities](../04-capabilities/02-catalog.md).


Предварительный концептуальный пример:

Права и placement объявляются **внутри** описания компонента, а не отдельными таблицами верхнего уровня: разнесение приводит к рассинхронизации при редактировании и упрощает случайное расширение прав.

```toml
[package]
id = "com.example.music"
version = "1.0.0"

[package.compatibility]
platforms = ["linux", "windows", "android"]

[[components]]
id = "main-ui"
type = "web-ui"
entry = "ui/index.html"

  [[components.capabilities]]
  name = "storage.replicated.read-write"
  version = "^1"

  [[components.capabilities]]
  name = "events.subscribe"
  version = "^1"

  [[components.capabilities]]
  name = "command.invoke"
  version = "^1"
  scope = ["scan-library"]

[[components]]
id = "library-indexer"
type = "worker"
entry = "workers/indexer.wasm"
activation = ["app-start", "files-changed"]

  [components.placement]
  scope = "per-user"
  requires = ["compute.background"]
  prefers = ["power.ac", "network.unmetered"]
  remote = "allowed"

  [[components.capabilities]]
  name = "storage.replicated.read-write"
  version = "^1"

  [[components.capabilities]]
  name = "files.user.read"
  version = "^1"
  optional = false

  [[components.capabilities]]
  name = "media.probe"
  version = "^1"
  optional = true
  reason = "чтение тегов и длительности аудиофайлов"

[[components]]
id = "scan-library"
type = "command"
entry = "workers/indexer.wasm#scan"
```

Свойства модели manifest:

- глобально уникальный package ID и стабильные component IDs;
- capabilities объявляются на уровне компонента с **версией контракта** и, где применимо, со `scope`, ограничивающим область действия;
- `optional = true` означает, что компонент обязан работать при отказе в этом праве. Обязательные права, в которых отказано, переводят компонент в состояние `not-permitted`, а не запускают его с урезанной функциональностью;
- `reason` — человекочитаемое обоснование, показываемое в диалоге выдачи прав. Для чувствительных capabilities обязательно;
- декларативные activation events;
- декларация поддерживаемых платформ и platform-specific варианты артефактов при сохранении общего component contract;
- `placement` для каждого компонента: требования, предпочтения, допустимость удалённого исполнения;
- поведение при отсутствии совместимого runtime;
- декларация миграций данных;
- декларация потребности в материализации данных, влияющая на selective sync;
- криптографическая подпись пакета.

Точный формат manifest фиксируется отдельным документом вместе с каталогом capabilities.


