# Модель capabilities и прав

Статус: перенесено из прежних документов, требует ревизии.  
Назначение: определить пространство имён прав, контекст вызова, различие permission / grant / handle / delegation.

Связанные документы: [каталог capabilities](./02-catalog/00-index.md), [манифест](../03-apps/02-manifest.md), [границы безопасности](../10-security/02-threat-model.md).


Capability — ограниченное право выполнить класс операций. Permissions из manifest описывают запрашиваемые права, а runtime policy определяет, какие из них реально выданы на конкретном устройстве.

## Пространство имён capabilities

Имена capabilities строятся как `<домен>.<область>.<операция>`. Для данных действует однозначное соответствие «namespace — путь VFS — capability», зафиксированное таблицей в разделе о хранилищах. Расхождение между этой таблицей и любым другим местом документа считается дефектом.

```text
storage.local.read-write
storage.replicated.read-write
storage.cache.read-write
secrets.read-write

files.app.read-write
files.user.read
files.user.write
files.external.<mount-id>.read
files.external.<mount-id>.write

net.http:api.example.com
net.ws:example.com
net.listen:<port>
net.socket.tcp
mqtt.connect

api.export
api.call:<service>

events.subscribe
events.publish
command.invoke

media.probe
media.transcode
media.capture

vcs.git

system.info
system.info.detailed
system.power

process.exec:<program>
process.shell

notifications.show
background.run
device.location
gpio.line
serial.port

remote.delegate
```

Разделены две ортогональные оси, которые ранее смешивались в имени `storage.private`:

- **scope** — реплицируются ли данные: `local` или `replicated`;
- **visibility** — видны ли данные другим пакетам: по умолчанию все namespaces приватны для пакета, доступ другому пакету выдаётся отдельной capability.

Каждая capability имеет версию контракта. Полный каталог с сигнатурами интерфейсов, таксономией ошибок, правилами версионирования и таблицей доступности по платформам находится в [каталоге capabilities](./02-catalog/00-index.md). Этот каталог является источником истины: из него выводятся WIT, TypeScript SDK, имена прав в manifest и contract tests. При расхождении верен каталог.

## Контекст вызова

Каждый защищённый вызов содержит или восстанавливает следующий контекст:

```text
profile ID
node ID
package ID
component ID
execution ID
granted capabilities
trace ID
deadline
cancellation token
```

Проверка производится на границе системного API и не полагается только на скрытие методов во frontend SDK.

Capability handle должен быть:

- непрозрачным для приложения;
- ограниченным конкретным ресурсом и операциями;
- отзывным;
- привязанным к владельцу;
- автоматически освобождаемым;
- непригодным для передачи другому package без явного системного механизма.

Модель различает:

- permission, запрошенный package в manifest;
- grant, подтверждённый пользователем или system policy на конкретном node;
- runtime capability, выданную конкретному execution;
- resource handle, ограниченный конкретным объектом и операциями;
- delegation capability для явно разрешённого локального или удалённого вызова.

Право компонента на локальный ресурс не становится правом удалённого node автоматически. Delegation всегда ограничивает получателя, операции, scope, deadline и возможность дальнейшей передачи.

## Взаимозаменяемые backends

Тяжёлые внешние инструменты — FFmpeg, Git и подобные — не являются в K-OS отдельным механизмом расширения. **Внешний инструмент — это capability с несколькими взаимозаменяемыми backends:**

```text
capability: media.transcode / media.probe / vcs.git
        │
        ├── in-process library      предпочтительный backend
        ├── bundled sidecar         desktop, где библиотека неполна
        └── remote execution        исполнение на другом node профиля
```

Ранняя формулировка относила такие инструменты к sidecar-процессам. Это противоречит переносимости: на Android запуск произвольных процессов недоступен, а оба инструмента объявлены базовыми возможностями системы.

Правила:

1. **Публичный API — типизированное описание задачи, а не строка аргументов.** Транскодирование описывается входом, выходом, контейнером, кодеками и структурированными параметрами; операция Git — типом операции, ссылками и путями. Только так один и тот же вызов работает на всех backends.
2. **Сырые аргументы — отдельная capability.** Escape hatch вида «передать произвольные аргументы FFmpeg» существует, но требует отдельного разрешения, и компонент, использующий его, обязан объявить платформы, на которых он работает.
3. **Выбор backend делает runtime, а не приложение.** Приложение может узнать доступные возможности и ограничения, но не выбирает способ исполнения.
4. **Недоступность backend — явное состояние.** Если ни локального, ни удалённого backend нет, вызов возвращает `unavailable`, а не деградирует молча.

Тот же принцип применяется к любому будущему тяжёлому инструменту: сначала capability и типизированный контракт, только потом вопрос, чем он реализован на конкретной платформе. Конкретные сигнатуры — в [каталоге](./02-catalog/05-tools.md), допустимые механизмы расширения системы — в [модели расширяемости](../02-architecture/08-extensibility.md).

