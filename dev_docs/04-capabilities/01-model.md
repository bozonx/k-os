# Модель capabilities и прав

Статус: перенесено из прежних документов, требует ревизии.  
Назначение: определить пространство имён прав, контекст вызова, различие permission / grant / handle / delegation.

Связанные документы: [каталог capabilities](./02-catalog.md), [манифест](../03-apps/02-manifest.md), [границы безопасности](../11-security/01-boundaries.md).


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
net.socket.tcp
mqtt.connect

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

Каждая capability имеет версию контракта. Полный каталог с сигнатурами интерфейсов, таксономией ошибок, правилами версионирования и таблицей доступности по платформам находится в [каталоге capabilities](../04-capabilities/02-catalog.md). Этот каталог является источником истины: из него выводятся WIT, TypeScript SDK, имена прав в manifest и contract tests. При расхождении верен каталог.

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


