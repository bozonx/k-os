# Загрузка системы

Статус: перенесено из прежних документов, требует ревизии.  
Назначение: зафиксировать порядок запуска подсистем и правила разрыва циклических зависимостей.

Связанные документы: [services](./05-services.md), [облачная нода](../09-clients/04-cloud-node.md).


Порядок запуска следует из разделения на control plane и feature services:

1. platform runtime и конфигурация устройства;
2. logging и crash reporting;
3. node identity и key storage;
4. profile control log: состав профиля, роли, grants;
5. permissions и capability registry;
6. host adapters;
7. drivers/resource brokers;
8. storage, VFS и blob store;
9. package registry и application runtime;
10. network layer, synchronization и координация nodes;
11. scheduler и activation manager;
12. системная оболочка и пользовательские компоненты.

Пункты 1–5 составляют control plane и не зависят от последующих. Пункт 12 отсутствует на cloud node: ядро обязано завершать загрузку и работать без него.

Каждый этап объявляет зависимости явно. Циклические зависимости между services запрещены либо разрываются через события и отложенную активацию.


