# Сообщения, удалённые вызовы и делегирование

Статус: перенесено из прежних документов, требует ревизии.  
Назначение: зафиксировать обязательный контекст операции, семантику доставки и правила делегирования прав другой ноде.

Связанные документы: [координация](./08-coordination.md), [процессы хоста](../04-capabilities/02-catalog/05-tools.md), [управление устройствами](../08-devices/02-node-control.md).


## Обязательный контекст

Любая durable или повторяемая операция содержит:

```text
profile ID
source node ID
destination or routing scope
protocol/schema ID and version
operation ID
idempotency key when applicable
deadline
causal context when required
authorization context
trace ID
```

Caller identity не передаётся как доверенное поле приложения. Она выводится из аутентифицированной node session и delegation capability, выданной системным runtime.

## Семантика доставки

Exactly-once не является базовой гарантией. Для каждого типа operation явно определяются:

- at-most-once или at-least-once delivery;
- idempotency key;
- срок хранения deduplication records;
- timeout и retry budget;
- cancellation semantics;
- допустимость выполнения после deadline;
- владение результатом;
- поведение при network partition.

Локальный и удалённый вызов используют один versioned contract, но удалённый результат всегда допускает ошибки `unreachable`, `deadline-exceeded`, `placement-changed`, `authorization-expired` и `result-unknown`.

`result-unknown` не является исключительной ситуацией. Вызывающий код обязан её обрабатывать: либо операция идемпотентна, либо есть способ узнать её исход.


## Делегирование


Право компонента на локальный ресурс не переносится на remote node автоматически.

Delegation token содержит: издающий node, субъекта (profile, package, component, execution), целевую capability и её scope, deadline, признак возможности дальнейшей передачи и подпись.

Проверка на целевом node двусторонняя:

1. token валиден, не истёк, издан узлом с соответствующими полномочиями;
2. локальная политика целевого node сама по себе разрешает этому package использовать эту capability здесь.

Отсутствие второй проверки означало бы, что компрометация одного устройства даёт доступ к оборудованию всех остальных.

По умолчанию delegation непереходящая. Результат удалённого вызова подчиняется описанной выше семантике доставки: `result-unknown` является допустимым исходом.

Типовой сценарий: UI на телефоне управляет GPIO на Linux-ноде. Это основной, а не краевой случай, поэтому remote capability является частью базовой модели, а не расширением.


