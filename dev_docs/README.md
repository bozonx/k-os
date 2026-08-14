# Проектная документация K-OS

Набор design documents K-OS. Документы описывают проектируемую систему, а не текущее
состояние кода: реализация следует за документом, а не наоборот.

## Как читать

Порядок для первого знакомства:

1. [Видение](./01-overview/01-vision.md) — что такое K-OS и какое обещание она даёт пользователю.
2. [Словарь](./01-overview/02-glossary.md) — термины, используемые во всех документах.
3. [Принципы](./01-overview/03-principles.md) — сквозные правила, которым подчинены все подсистемы.
4. [Слои системы](./02-architecture/01-layers.md) — вертикаль от host adapters до приложений.
5. [Базовый стек](./02-architecture/12-base-stack.md) — эта вертикаль на примере HTTP, WebSocket и файлов.
6. Дальше — по интересующей области: приложения, права, хранилище, сеть, клиенты.

Быстрые входы по ролям:

| Интерес | Начинать с |
|---|---|
| пишу приложение | [модель приложения](./03-apps/01-app-model.md) → [данные приложения](./03-apps/06-app-data-api.md) → [каталог capabilities](./04-capabilities/02-catalog.md) |
| реализую ядро | [слои](./02-architecture/01-layers.md) → [host adapters](./02-architecture/04-host-adapters.md) → [drivers](./02-architecture/05-drivers.md) → [базовый стек](./02-architecture/12-base-stack.md) |
| занимаюсь сетью | [сеть пользователя](./06-network/01-overview.md) → [создание сети](./07-onboarding/01-network-lifecycle.md) → [NAT](./07-onboarding/02-nat-and-reachability.md) |
| занимаюсь интерфейсом | [системная оболочка](./10-clients/04-system-shell.md) → [frontend приложения](./03-apps/04-frontend.md) → [десктоп](./10-clients/01-desktop.md) |

## Статусы документов

| Статус | Значение |
|---|---|
| `готов` | документ отражает принятое решение |
| `перенесён` | содержимое перенесено из прежних документов, требует ревизии и согласования ссылок |
| `план` | зафиксировано только назначение и план содержания, документ не наполнен |
| `направление` | направление развития за пределами основной поставки |

## Карта документов

### 01. Обзор

| Документ | Статус | Содержание |
|---|---|---|
| [01-vision](./01-overview/01-vision.md) | готов | продуктовое обещание, состав системы, ключевые решения одним взглядом |
| [02-glossary](./01-overview/02-glossary.md) | готов | единый словарь терминов |
| [03-principles](./01-overview/03-principles.md) | готов | сквозные архитектурные принципы и инварианты |
| [04-roadmap](./01-overview/04-roadmap.md) | готов | что входит в MVP, что отложено, порядок развития |
| [05-open-questions](./01-overview/05-open-questions.md) | готов | нерешённые вопросы и то, что намеренно не выбирается сейчас |

### 02. Архитектура ядра

| Документ | Статус | Содержание |
|---|---|---|
| [01-layers](./02-architecture/01-layers.md) | перенесён | слои, control plane, границы Rust / TypeScript / WebAssembly |
| [02-profile-and-nodes](./02-architecture/02-profile-and-nodes.md) | перенесён | профиль, нода, роли нод, установка и размещение |
| [03-platforms](./02-architecture/03-platforms.md) | готов | целевые платформы и правила переносимости |
| [04-host-adapters](./02-architecture/04-host-adapters.md) | готов | нижний платформозависимый слой и его контракты |
| [05-drivers](./02-architecture/05-drivers.md) | готов | владение ресурсами, мультиплексирование, capability handles |
| [06-services](./02-architecture/06-services.md) | готов | control plane и feature services |
| [07-boot](./02-architecture/07-boot.md) | перенесён | порядок запуска подсистем |
| [08-workspace](./02-architecture/08-workspace.md) | перенесён | предварительная структура Rust workspace |
| [09-extensibility](./02-architecture/09-extensibility.md) | перенесён | допустимые механизмы расширения и уровни доверия |
| [10-correctness-criteria](./02-architecture/10-correctness-criteria.md) | перенесён | проверяемые критерии корректности архитектуры |
| [11-errors-and-observability](./02-architecture/11-errors-and-observability.md) | перенесён | ошибки, отмена, трассировка, метрики |
| [12-base-stack](./02-architecture/12-base-stack.md) | готов | базовые провайдеры и драйверы: HTTP client/server, WebSocket client/server, файловая система |

### 03. Приложения

| Документ | Статус | Содержание |
|---|---|---|
| [01-app-model](./03-apps/01-app-model.md) | перенесён | package, component, типы компонентов |
| [02-manifest](./03-apps/02-manifest.md) | перенесён | формат манифеста пакета |
| [03-lifecycle](./03-apps/03-lifecycle.md) | перенесён | жизненный цикл и активация компонентов |
| [04-frontend](./03-apps/04-frontend.md) | готов | UI приложения: размещение и требования к контейнеру |
| [05-backend-wasm](./03-apps/05-backend-wasm.md) | готов | необязательный backend приложения в WebAssembly |
| [06-app-data-api](./03-apps/06-app-data-api.md) | готов | изолированные данные приложения глазами разработчика |
| [07-distribution](./03-apps/07-distribution.md) | перенесён | установка, материализация, обновление, откат |
| [08-placement-and-execution](./03-apps/08-placement-and-execution.md) | перенесён | execution scope и выбор ноды исполнения |

### 04. Права и публичное API

| Документ | Статус | Содержание |
|---|---|---|
| [01-model](./04-capabilities/01-model.md) | перенесён | модель прав: permission, grant, handle, delegation |
| [02-catalog](./04-capabilities/02-catalog.md) | готов | каталог capabilities, единственный источник истины по API |
| [03-external-tools](./04-capabilities/03-external-tools.md) | перенесён | FFmpeg, Git и подобные инструменты как capability |
| [04-host-processes](./04-capabilities/04-host-processes.md) | перенесён | запуск программ хостовой ОС |

### 05. Данные

| Документ | Статус | Содержание |
|---|---|---|
| [01-state-model](./05-storage/01-state-model.md) | перенесён | namespaces, классы состояния, инварианты |
| [02-database](./05-storage/02-database.md) | готов | база данных приложения поверх слоя синхронизации |
| [03-vfs](./05-storage/03-vfs.md) | готов | виртуальная файловая система: контракт |
| [04-blobs-and-materialization](./05-storage/04-blobs-and-materialization.md) | перенесён | blob store, чанкование, selective sync, конфликты |

### 06. Сеть пользователя

| Документ | Статус | Содержание |
|---|---|---|
| [01-overview](./06-network/01-overview.md) | готов | назначение сетевого слоя и его гарантии |
| [02-identity-and-trust](./06-network/02-identity-and-trust.md) | перенесён | ключи, enrollment, revocation |
| [03-control-log](./06-network/03-control-log.md) | перенесён | журнал состава профиля и прав |
| [04-transport-and-discovery](./06-network/04-transport-and-discovery.md) | готов | каналы, выбор транспорта, обнаружение |
| [05-time](./06-network/05-time.md) | перенесён | модель времени и сверка часов |
| [06-rpc-and-delegation](./06-network/06-rpc-and-delegation.md) | перенесён | удалённые вызовы и делегирование прав |
| [07-replication](./06-network/07-replication.md) | перенесён | механизм репликации состояния |
| [08-coordination](./06-network/08-coordination.md) | перенесён | leases, лидерство, fencing token |
| [09-realtime](./06-network/09-realtime.md) | готов | realtime-возможности для приложений |
| [10-events-and-push](./06-network/10-events-and-push.md) | готов | доставка событий и push-уведомлений без дублирования |

### 07. Создание и расширение сети

| Документ | Статус | Содержание |
|---|---|---|
| [01-network-lifecycle](./07-onboarding/01-network-lifecycle.md) | готов | создание сети, подключение ноды, QR-коды, headless-подключение |
| [02-nat-and-reachability](./07-onboarding/02-nat-and-reachability.md) | готов | NAT, проброс портов, достижимость нод |

### 08. Взаимодействие пользователей

| Документ | Статус | Содержание |
|---|---|---|
| [01-model](./08-federation/01-model.md) | готов | связывание сетей разных пользователей |
| [02-sharing](./08-federation/02-sharing.md) | готов | обмен файлами и доступом без передачи владения |
| [03-messaging](./08-federation/03-messaging.md) | готов | обмен сообщениями между сетями |

### 09. Устройства и IoT

| Документ | Статус | Содержание |
|---|---|---|
| [01-model](./09-devices/01-model.md) | готов | подключённые устройства как ресурс сети пользователя |
| [02-node-control](./09-devices/02-node-control.md) | готов | удалённое управление нодами |
| [03-device-sharing](./09-devices/03-device-sharing.md) | готов | предоставление доступа к устройствам другим пользователям |

### 10. Клиенты и формы поставки

| Документ | Статус | Содержание |
|---|---|---|
| [01-desktop](./10-clients/01-desktop.md) | готов | десктопный клиент, режимы запуска, демон, ярлыки |
| [02-mobile](./10-clients/02-mobile.md) | готов | Android и мобильный Linux, режим launcher |
| [03-cloud-node](./10-clients/03-cloud-node.md) | готов | облачная нода |
| [04-system-shell](./10-clients/04-system-shell.md) | готов | системная оболочка: панель, launcher, диалоги, настройки |

### 11. Безопасность

| Документ | Статус | Содержание |
|---|---|---|
| [01-boundaries](./11-security/01-boundaries.md) | перенесён | границы безопасности системы и сети |
| [02-isolation](./11-security/02-isolation.md) | перенесён | изоляция Web UI и WebAssembly workers |
| [03-threat-model](./11-security/03-threat-model.md) | готов | модель угроз и допущения |

### 12. Тестируемость

| Документ | Статус | Содержание |
|---|---|---|
| [01-determinism-and-simulation](./12-testing/01-determinism-and-simulation.md) | перенесён | детерминированная симуляция кластера и проверяемые инварианты |

### 13. Направления развития

| Документ | Статус | Содержание |
|---|---|---|
| [01-bootstrap-discovery](./13-future/01-bootstrap-discovery.md) | направление | распределённое обнаружение нод через bootstrap-узлы |
| [02-compute-market](./13-future/02-compute-market.md) | направление | предоставление вычислительных ресурсов за вознаграждение |
| [03-web3-and-social](./13-future/03-web3-and-social.md) | направление | публичные сервисы и соцсети поверх пользовательских данных |

## Правила ведения документов

1. **Один факт живёт в одном документе.** Остальные ссылаются на него. Дублирование
   формулировок приводит к расхождению при правках.
2. **Каталог capabilities — источник истины по публичному API.** При расхождении
   с любым другим документом верен [каталог](./04-capabilities/02-catalog.md).
3. **Контракт и механизм разделены.** Документы разделов 03–05 описывают, что видит
   приложение; раздел 06 — как это работает между устройствами.
4. **Изменение начинается с документа**, затем меняются контракты, затем код.
5. Документ, переведённый в статус `готов`, меняется осознанно: правка формулировки
   контракта равнозначна правке кода.

## Что осталось доработать

Разделы 03–13 наполнены; в статусе `перенесён` остаются документы, содержание которых не
менялось при последней проработке. По ним необходимо:

- проверить внутренние ссылки вида «см. раздел 7» — сквозная нумерация прежних
  документов не сохранена;
- перепроверить ссылки на соседние документы, часть из них временно ведёт на эту карту;
- согласовать формулировки с документами, переведёнными в статус `готов`.

Список оставшихся `перенесён`: [01-layers](./02-architecture/01-layers.md),
[02-profile-and-nodes](./02-architecture/02-profile-and-nodes.md),
[07-boot](./02-architecture/07-boot.md), [08-workspace](./02-architecture/08-workspace.md),
[09-extensibility](./02-architecture/09-extensibility.md),
[10-correctness-criteria](./02-architecture/10-correctness-criteria.md),
[11-errors-and-observability](./02-architecture/11-errors-and-observability.md),
[01-app-model](./03-apps/01-app-model.md), [02-manifest](./03-apps/02-manifest.md),
[03-lifecycle](./03-apps/03-lifecycle.md), [07-distribution](./03-apps/07-distribution.md),
[08-placement-and-execution](./03-apps/08-placement-and-execution.md),
раздел 04 кроме каталога, [01-state-model](./05-storage/01-state-model.md),
[04-blobs](./05-storage/04-blobs-and-materialization.md), документы сети 02, 03, 05–08,
[11-security](./11-security/01-boundaries.md) 01–02,
[12-testing](./12-testing/01-determinism-and-simulation.md).
