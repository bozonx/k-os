# Drivers и resource brokers

Статус: перенесено из прежних документов, требует ревизии.  
Назначение: описать слой владения ресурсами: мультиплексирование, очереди, retry, quotas и выдачу capability handles.

Связанные документы: [host adapters](./04-host-adapters.md), [модель capabilities](../04-capabilities/01-model.md).


Driver, или resource broker, превращает host adapter в управляемый системный ресурс.

Driver отвечает за:

- создание и переиспользование соединений;
- владение ресурсами и их освобождение;
- multiplexing между потребителями;
- очереди, backpressure и rate limits;
- reconnect, retry и timeout policy;
- сбор метрик и статистики;
- проверку валидности, scope и ownership выданных capability handles;
- выдачу ограниченных capability handles;
- платформенные ограничения времени жизни ресурса.

Например, socket host adapter открывает низкоуровневое соединение. Network broker управляет соединением и backpressure, а MQTT service маршрутизирует подписки и реализует семантику протокола.

Приложение не получает прямую ссылку на driver. Оно получает непрозрачный handle:

```rust
let connection = ctx
    .capabilities()
    .mqtt()
    .connect(options)
    .await?;
```

Handle связан с package ID, component ID, permissions и временем жизни владельца. Освобождение владельца закрывает или возвращает ресурс в управляемый pool.

Решение о выдаче права принимает централизованный authorization/capability service на входе в системный API. Driver не интерпретирует manifest и пользовательские grants самостоятельно. Повторная проверка ограничений handle в driver является defense-in-depth и защитой конкретного ресурса.

В первой версии drivers являются встроенными. Устанавливаемые native drivers откладываются до появления подтверждённых сценариев нового оборудования или протоколов.


