# Системные services

Статус: перенесено из прежних документов, требует ревизии.  
Назначение: разделить control plane и feature services, зафиксировать правила их запуска и зависимостей.

Связанные документы: [загрузка системы](./07-boot.md), [слои системы](./01-layers.md).


Service — высокоуровневая системная функция, построенная поверх drivers и других services.

Services делятся на две группы с разными правилами запуска и зависимостей.

**Control plane** — то, от чего зависит проверка прав. Эти компоненты не могут быть capability-gated и не вызывают feature services:

- node identity и key storage;
- profile control log: состав профиля, роли nodes, grants;
- capability registry и permission evaluation;
- package registry;
- logging и crash reporting.

**Feature services** — системные функции, доступные компонентам через capability API:

- application runtime;
- package manager;
- storage и VFS;
- synchronization;
- secrets;
- scheduler;
- notifications;
- media;
- внешние инструменты: transcode, vcs;
- telemetry.

Различие существенно: попытка проверить право на запись в лог через сервис, который сам пишет лог, даёт цикл. Порядок запуска в разделе о загрузке системы следует из этого разделения.

Service является runtime-ролью, но не отдельной обязательной единицей установки для пользователя. Пользовательский backend входит в package приложения как worker.

Системные services запускаются ядром в определённом порядке и могут иметь расширенные внутренние права. Пользовательский worker не становится системным service и не получает системных прав из-за фонового режима работы.


