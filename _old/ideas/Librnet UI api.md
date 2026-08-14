## Что входит
- User data - данные о пользователе
- App data - id приложения, его названия и другие данные о нём
- System - доступ к системе

State
- Page - in memory state of the page of the oppened tab while it will be reloaded or closed
- Browser (localStorage)
- Sync - синхронизируемый на бэкэнде общий стейт (хранится в файле) (это стейт приложения, если его удалить то ничего страшного не произойдёт), от настроек отличается тем что предполагает частое изменение в процессе работы приложения

Settings
- Browser (localStorage)
- uiBuiltin - встроенные настройки для UI
- Local - server side non sync settings
- Sync - server side synced settings
- appBuildin - встроенные настройки для всего приложения

Api
- Call server side api of the app. То апи которое ты сам написал

SyncDocDb
- Можно создавать несколько баз
- Базы только синхронизируемые
- что то типа pouchDb

SyncSqlDb
- Можно создават несколько баз
- https://github.com/eligrey/FileSaver.js/ можно работать с CSV. Нет коннектора для prisma

Files
- AppLocal локальные файлы приложения
- AppSync синхронизируемые файлы приложений
- Device доступ к сем файлам устройства или тем к которым разрешили
- User - все синхронизируемые данные пользователя

log
- Local - локальный лог не синхронизируемый
- Sync - синхронизируемый
