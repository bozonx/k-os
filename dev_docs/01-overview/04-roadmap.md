# Объём версий и дорожная карта

Статус: перенесено из прежних документов, требует ревизии.  
Назначение: зафиксировать, что входит в MVP, что отложено и в каком порядке развивается система.

Связанные документы: [видение](./01-vision.md), [открытые вопросы](./05-open-questions.md), [направления развития](../13-future/).

## Первая версия


В MVP входят:

- Tauri shell с одним окном: системная оболочка и контейнер приложения;
- Linux, Windows и Android platform ports, а также headless-сборка Linux;
- встроенные Rust host adapters, включая `ClockAdapter`, `RandomAdapter`, `SystemAdapter` и `ProcessAdapter`;
- встроенные drivers/resource brokers;
- control plane: node identity, control log, capability registry;
- package manifest и базовый package manager;
- Web UI components и capability bridge;
- WebAssembly workers;
- lifecycle и event activation;
- namespaces `local`, `replicated`, `cache`, `secrets`, `files`;
- VFS с метаданными, blob store и материализацией по запросу;
- permissions, grants и capability handles;
- симуляционный харнесс и contract tests с первого дня.

В MVP не входят:

- устанавливаемые platform extension packages;
- пользовательские Rust dynamic libraries;
- пользовательские постоянно работающие daemons;
- полностью прозрачный distributed RPC;
- универсальный интерфейс для всех видов host adapters;
- мультиоконность;
- обещание одинаковых фоновых гарантий на desktop и mobile;
- macOS и iOS platform ports и связанный с ними код;
- одинаковое размещение всех components на всех nodes;
- совместное редактирование текста как тип реплицируемых данных.



## Направления развития за пределами основной поставки

Эти направления зафиксированы, чтобы не влиять на решения основной системы, но и не быть
забытыми:

- [распределённое обнаружение нод через bootstrap-узлы](../13-future/01-bootstrap-discovery.md);
- [рынок вычислительных ресурсов](../13-future/02-compute-market.md);
- [публичные сервисы и социальные сети поверх данных пользователя](../13-future/03-web3-and-social.md).

## Требует дополнения

Перечень первой версии составлен до появления документов разделов 07–10 и нуждается в
согласовании с ними: создание и расширение сети, взаимодействие пользователей, управление
устройствами и формы поставки клиентов пока в нём не отражены.
