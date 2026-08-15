# Манифест пакета

Статус: перенесено из прежних документов, требует ревизии.  
Назначение: зафиксировать состав манифеста: компоненты, объявление прав, placement, активацию и совместимость.

Связанные документы: [модель приложения](./01-app-model.md), [модель capabilities](../04-capabilities/01-model.md), [каталог capabilities](../04-capabilities/02-catalog/00-index.md).


Предварительный концептуальный пример:

Права и placement объявляются **внутри** описания компонента, а не отдельными таблицами верхнего уровня: разнесение приводит к рассинхронизации при редактировании и упрощает случайное расширение прав.

```toml
[package]
id = "com.example.music"
version = "1.0.0"

[package.compatibility]
platforms = ["linux", "windows", "android"]
min-runtime = "0.4"               # минимальная версия runtime K-OS

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
- `min-runtime` — минимальная версия runtime K-OS. Ноды профиля обновляются не одновременно,
  поэтому версия пакета, требующая более нового runtime, не активируется, пока способные
  исполнять её ноды не готовы, см. [распространение](./07-distribution.md) и
  [обновление системы](../09-clients/06-system-update.md);
- `placement` для каждого компонента: требования, предпочтения, допустимость удалённого исполнения;
- поведение при отсутствии совместимого runtime;
- декларация миграций данных;
- декларация настроек: ключи, типы, значения по умолчанию, допустимость переопределения на ноде;
- декларация потребности в материализации данных, влияющая на политику материализации;
- криптографическая подпись пакета.

## Декларации, влияющие на другие подсистемы

Помимо компонентов и прав манифест содержит объявления, от которых зависит поведение
хранилища, сети и оболочки. Они собраны здесь, потому что каждое из них проверяется при
установке, а не во время работы.

### Схема данных

```toml
[[collections]]
name = "tracks"
type = "document"
namespace = "app.data.replicated"
schema-version = 3

  [[collections.indexes]]
  fields = ["artist", "title"]

[[collections]]
name = "search-index"
type = "document"
namespace = "app.data.local"
derived = true
```

Правила: коллекция принадлежит одному namespace и наследует его класс; индексы объявляются
заранее, потому что запрос без индекса отклоняется при установке, а не деградирует в
полное сканирование; `derived = true` означает восстанавливаемые данные, которые не
реплицируются. Совместимость версий схемы и миграции — в
[базе данных приложения](../05-storage/02-database.md).

### Настройки

```toml
[[settings]]
key = "syncIntervalMs"
type = "integer"
default = 300000
min = 60000
max = 3600000
title = "Интервал обновления"

[[settings]]
key = "audioDevice"
type = "string"
default = ""
node-override = true              # допускает переопределение на конкретной ноде
```

Объявление настроек делает две вещи: задаёт слой значений по умолчанию для
[фасада `config`](../04-capabilities/02-catalog/03-data.md) и позволяет системной оболочке
построить экран настроек приложения, не запуская его. Значение, не соответствующее
объявленному типу и границам, отклоняется при записи. `node-override = false` — значение
по умолчанию: настройка живёт только в слое профиля и одинакова на всех устройствах.

### Экспортируемое API

```toml
[[components.api]]
service = "library"

  [[components.api.methods]]
  name = "search"
  audience = "profile-nodes"     # profile-nodes | linked-users | local-packages
  idempotent = true
```

Вызов метода, чья аудитория не покрывает вызывающего, отклоняется до активации обработчика.
Метод с `idempotent = false` не повторяется системой автоматически. Механизм — в
[базовом стеке](../02-architecture/06-base-stack.md).

### Представления

```toml
[[components]]
id = "main-ui"
type = "web-ui"
entry = "ui/index.html"
multi-view = false                # несколько окон одного приложения
handles = ["kos://app/com.example.music/*", "audio/*"]
```

`multi-view = false` — значение по умолчанию: повторный запуск фокусирует существующее
представление. `handles` объявляет ссылки и типы файлов, которые приложение готово
открывать; система использует это для выбора приложения, а не приложение — для перехвата.

### Фоновая работа

```toml
[components.background]
checkpoint = "replicated"         # replicated | device-local
max-runtime-ms = 600000
activation-rate = "low"
```

Класс checkpoint определяет, может ли задача быть продолжена другой нодой: `device-local`
привязывает её к устройству. Запрошенные бюджеты являются пожеланием: фактические лимиты
задаёт политика ноды.

Точный формат manifest фиксируется отдельным документом вместе с каталогом capabilities.


