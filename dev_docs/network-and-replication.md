# Сеть и репликация K-OS

Статус: предварительный design outline  
Назначение: зафиксировать границы будущего network layer и инварианты синхронизации, не выбирая преждевременно конкретные протоколы, database engine или consensus algorithm.

## 1. Цель

Network layer связывает доверенные nodes одного profile через доступные каналы и предоставляет transport-independent основу для:

- синхронизации состояния и файлов;
- доставки событий;
- удалённого исполнения commands и jobs;
- передачи package artifacts;
- обнаружения nodes и оценки их доступности.

Сеть не должна делать распределённые операции неотличимыми от локальных. Недоступность node, задержка, отмена, повтор, частичный результат и конфликт являются частью публичной семантики.

## 2. Предварительное разбиение

```text
Device identity and trust
          ↓
Peer discovery and reachability
          ↓
Link adapters: LAN / Internet relay / Bluetooth LE
          ↓
Authenticated encrypted sessions
          ↓
Multipath connection manager
          ↓
Streams / messages / datagrams
          ↓
Replication / RPC / events / package transfer
```

Link adapter отвечает только за конкретный канал. Identity, шифрование, повторная установка session, routing и прикладные сообщения не должны дублироваться отдельно для LAN, Internet и Bluetooth.

## 3. Выбор канала

Локальный канал предпочтителен, когда он действительно лучше, но порядок не задаётся жёстко. Connection manager оценивает:

- reachability и стабильность;
- latency и bandwidth;
- metered/unmetered status;
- energy cost;
- доверие к каналу;
- максимальный размер передачи;
- возможность streaming/resume;
- background availability;
- стоимость установки соединения.

Session может менять link без изменения identity peer и, в будущем, использовать несколько links одновременно.

## 4. Базовая идентичность сообщений

Любая durable или повторяемая операция должна иметь как минимум:

```text
profile ID
source node ID
destination or routing scope
protocol/schema ID and version
operation ID
deadline
causal context when required
authorization context
trace ID
```

Caller identity не передаётся как доверенное поле приложения. Она выводится из authenticated node session и capability delegation, выданной системным runtime.

## 5. Доставка и удалённые вызовы

Exactly-once не является базовой гарантией. Для каждого типа operation явно определяются:

- at-most-once или at-least-once delivery;
- idempotency key;
- срок хранения deduplication records;
- timeout и retry budget;
- cancellation semantics;
- допустимость выполнения после deadline;
- ownership результата;
- поведение при network partition.

Локальный и удалённый вызов могут использовать один versioned contract, но удалённый результат всегда допускает ошибки `unreachable`, `deadline-exceeded`, `placement-changed`, `authorization-expired` и `result-unknown`.

## 6. Синхронизация состояния

Приложение выбирает требуемую семантику данных, а не конкретный replication algorithm. Предварительные классы:

- replicated document/map/set/list;
- append-only event log;
- immutable blob;
- coordinated record;
- device-local и derived state, не участвующие в replication.

Локальная подтверждённая mutation должна атомарно обновлять materialized state и durable replication outbox/op log. Sync не должен восстанавливать пропущенные изменения путём наблюдения за обычной database постфактум.

Каждая mutation должна иметь stable object ID, origin node ID, operation ID, schema version и causal metadata, требуемую выбранным consistency profile.

Точные CRDT, version vectors, storage engine, compaction и conflict API будут определены отдельным ADR до стабилизации публичного replicated storage API.

## 7. Файлы

Единая filesystem понимается как логическое namespace, а не как полностью одинаковое POSIX-дерево на каждом node:

```text
metadata namespace
       +
content-addressed immutable blobs
       +
per-node materialization and cache
       +
explicit local/external mounts
```

Файл может быть materialized, metadata-only, remote-only, downloading, conflicted, evicted или temporarily unavailable. File identity не должна зависеть только от path. Selective sync, pinning, streaming, tombstones, atomic publish и platform-specific правила имён будут спроектированы отдельно.

## 8. Coordination

Один consensus mechanism не используется для всех задач:

- causal replication или CRDT подходят для многих пользовательских данных;
- deterministic conflict resolution подходит для части domain state;
- lease с fencing token подходит для временного single owner;
- leader election является механизмом размещения/координации, а не общей гарантией доступности;
- quorum consensus вводится только для небольшого набора control state, если без единого порядка невозможно обеспечить корректность.

Персональные nodes часто выключены или приостановлены, поэтому система не должна требовать постоянного quorum для обычной локальной работы.

## 9. Security boundaries

- каждый node имеет отдельную криптографическую identity;
- добавление node требует enrollment и подтверждения profile;
- transport использует взаимную аутентификацию и шифрование независимо от link;
- удалённое выполнение требует явной ограниченной delegation capability;
- право локального component на ресурс не переносится автоматически на remote node;
- удаление или компрометация node требует revocation и ротации соответствующих ключей;
- secrets и пользовательские данные шифруются согласно отдельной key hierarchy design.

## 10. Что намеренно не выбирается сейчас

- конкретный discovery protocol;
- формат wire messages;
- QUIC, WebSocket или другой основной Internet transport;
- relay infrastructure;
- CRDT library и database engine;
- конкретный consensus implementation;
- формат blob chunking;
- политика conflict UI;
- окончательный Bluetooth protocol.

Эти решения принимаются после стабилизации identity, capability contracts, storage mutation model и component placement.
