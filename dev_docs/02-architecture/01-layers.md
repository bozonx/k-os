# Слои системы и границы реализации

Статус: перенесено из прежних документов, требует ревизии.  
Назначение: зафиксировать вертикаль слоёв, control plane, направление зависимостей и границу между Rust, TypeScript и WebAssembly.

Связанные документы: [принципы](../01-overview/03-principles.md), [host adapters](./03-host-adapters.md), [drivers](./04-drivers.md), [services](./05-services.md), [базовый стек](./06-base-stack.md).


```text
┌─────────────────────────────────────────────────────┐
│                       Web UI                        │
│ React / Vue / Svelte / vanilla JS / Canvas / WebGL │
└─────────────────────────┬───────────────────────────┘
                          │ capability API / RPC
┌─────────────────────────▼───────────────────────────┐
│                Application Runtime                  │
│ Web UI components │ workers │ commands │ lifecycle │
└─────────────────────────┬───────────────────────────┘
                          │ service calls
┌─────────────────────────▼───────────────────────────┐
│                  System Services                    │
│ storage │ sync │ scheduler │ media │ notifications │
└─────────────────────────┬───────────────────────────┘
                          │ capability handles
┌─────────────────────────▼───────────────────────────┐
│            Drivers / Resource Brokers               │
│ ownership │ multiplexing │ retry │ quotas │ metrics │
└─────────────────────────┬───────────────────────────┘
                          │ typed adapter contracts
┌─────────────────────────▼───────────────────────────┐
│                   Host Adapters                     │
│ files │ sockets │ BLE │ key store │ clock │ system │
└─────────────────────────┬───────────────────────────┘
                          │
               OS / network / hardware
```

Схема описывает **направление зависимостей**, а не строгие уровни: service может использовать другой service, driver — другой driver. Запрещены только обратные зависимости, то есть обращение нижнего слоя к верхнему.

Отдельно от этой вертикали существует **control plane** — набор компонентов, от которых зависит сама проверка прав и потому не может быть capability-gated:

```text
Control plane
├── Node identity и key storage
├── Profile control log (состав профиля, роли, grants)
├── Capability registry и permission evaluation
├── Package registry
└── Logging и crash reporting
```

Control plane поднимается раньше остальных services и не вызывает их. Feature services — storage, media, notifications, scheduler — используют control plane, но не наоборот.

Через все слои проходят сквозные механизмы:

- идентификация вызывающего компонента;
- permissions и capability handles;
- lifecycle и cancellation;
- журналирование, трассировка и метрики;
- управление локальным и replicated state;
- обнаружение устройств;
- установка, обновление и удаление пакетов.

## Распределение ответственности

Одной строкой на каждое понятие — за что оно отвечает и за что не отвечает никто другой:

```text
Host adapter       — как выполнить платформенную операцию.
Driver             — как безопасно владеть и делить ресурс.
Control plane      — кто входит в профиль и что кому разрешено.
Service            — какую системную функцию предоставить.
Package            — что устанавливает пользователь.
Web UI             — что работает во view внутри сеанса оболочки ноды.
Worker             — backend приложения, активируемый runtime.
Capability API     — единственный путь к защищённым возможностям.
Storage namespace  — семантическое место хранения состояния.
VFS                — единое имя данных на всех устройствах профиля.
Placement          — где допустимо и предпочтительно исполнять component.
Node role          — что устройство вообще способно и обязано делать.
```

Главное следствие этой модели: frontend и backend могут принадлежать одному приложению, но
имеют независимый жизненный цикл. Backend оформляется как worker внутри package, а не как
отдельно устанавливаемый пользовательский service. Системные services остаются частью
доверенной платформы K-OS.

Проверяемые условия, которым обязано удовлетворять решение по каждому из этих пунктов,
собраны в [критериях корректности](../11-development/03-correctness-criteria.md).

## Граница Rust, TypeScript и WebAssembly

K-OS использует гибридную архитектуру. Доверенное ядро и системный control plane работают вне WebView на Rust. WebView является клиентом системы и не владеет системным состоянием, соединениями или планировщиком.

| Область | Основная реализация |
|---|---|
| Host adapters | Rust |
| Drivers / resource brokers | Rust |
| Permissions и capability handles | Rust |
| Package manager и application runtime | Rust |
| Storage, synchronization и distributed coordination | Rust |
| Scheduler и lifecycle | Rust |
| Tauri/WebView bridge | Rust и сгенерированный TypeScript SDK |
| Системный UI | TypeScript |
| UI приложений | Любая web-технология |
| Backend приложений | Изолированный WebAssembly worker |
| Native-интеграции ОС | Rust/Tauri plugins |

Граница доверия выглядит следующим образом:

```text
Недоверенная зона
├── Web UI приложения
└── WebAssembly worker приложения
             │
             │ capability API / IPC
             ▼
Доверенная зона
├── Application Runtime
├── System Services
├── Control Plane
├── Drivers / Resource Brokers
└── Host Adapters
```

TypeScript SDK является удобной типизированной оболочкой над capability API, но не реализует безопасность. Все permissions, identity вызывающего компонента, quotas и ограничения ресурсов проверяются на стороне Rust.

Система не должна исполняться внутри browser runtime по следующим причинам:

- жизненный цикл WebView связан с окном и управляется платформой;
- JavaScript-контекст может быть перезагружен, приостановлен или выгружен;
- системные соединения и синхронизация должны жить независимо от UI;
- системные ключи и привилегированные API нельзя помещать в недоверенную среду;
- mobile и desktop предоставляют разные гарантии фонового исполнения.

Открытое desktop-окно может использоваться для оптимизации, но не является архитектурной гарантией доступности процесса.


## Взаимодействие services и компонентов


Компоненты находят services через service registry и типизированные контракты. Они не получают произвольные Rust-объекты и не обращаются напрямую к внутренним менеджерам.

Концептуальный локальный API:

```rust
let media = ctx.services().require::<MediaService>(">=1.2")?;
let result = media.transcode(request).await?;
```

Контракт не должен зависеть от нестабильного Rust ABI. Для разных границ могут использоваться:

- WIT и WebAssembly Component Model для workers;
- сериализуемые versioned messages для IPC/RPC;
- Protobuf, CBOR или MessagePack со схемой;
- generated TypeScript API для Web UI.

Локальный и удалённый вызов могут иметь одинаковые типы запроса и ответа, но API обязан сохранять сетевую семантику: timeout, cancellation, недоступность узла, повтор и idempotency.


