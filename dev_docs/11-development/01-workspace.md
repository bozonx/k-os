# Структура кодовой базы

Статус: перенесено из прежних документов, требует ревизии.  
Назначение: зафиксировать предварительное разбиение Rust workspace на crates и ограничения зависимостей.

Связанные документы: [слои системы](../02-architecture/01-layers.md), [тестируемость](./02-determinism-and-simulation.md).


Предварительная структура, не являющаяся окончательным разбиением crates:

```text
crates/
├── kernel/                 # запуск и координация; не зависит от tauri
├── contracts/              # IDL, DTO, версии публичных контрактов
├── capabilities/           # permissions, grants, handles, caller context
├── host-adapters/          # traits контрактов + общие типы
├── host-mock/              # mock-реализации всех контрактов
├── host-linux/             # Linux implementations
├── host-windows/           # Windows implementations
├── host-android/           # Android implementations
├── drivers/                # resource brokers
├── services/               # системные services
├── storage/                # namespaces, mutation log, persistence
├── vfs/                    # дерево, метаданные, материализация
├── blobs/                  # content-addressed store и chunking
├── net/                    # link adapters, сессии, транспорт
├── sync/                   # репликация и control log
├── app-runtime/            # package/component lifecycle
├── wasm-runtime/           # запуск workers
├── sim/                    # симуляция кластера и fault injection
├── tauri-host/             # интеграция с Tauri и bridge
└── kos-headless/           # точка входа cloud node
```

Ключевое ограничение структуры: `kernel` и всё, что ниже него, не зависят от `tauri`. Зависимость от `tauri` допустима только в `tauri-host`. Это проверяется в CI, потому что нарушение обнаруживается иначе только при попытке собрать headless-вариант.

`host-mock` и `sim` не являются тестовой инфраструктурой в обычном смысле: они входят в состав системы и поддерживаются наравне с платформенными реализациями.

Не следует сразу создавать crate для каждого небольшого типа. Границы crates вводятся там, где нужны отдельные зависимости, платформенная компиляция, стабильный контракт или изоляция тестирования.


