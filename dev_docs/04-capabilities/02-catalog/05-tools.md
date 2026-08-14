# Каталог: медиа, Git и процессы хоста

Статус: design document, версия каталога `0.1`  
Назначение: тяжёлые внешние инструменты и запуск программ хостовой ОС.

Смежные документы: [правила каталога](./00-index.md), [общие типы](./01-common-types.md), [модель capabilities](../01-model.md).

## Медиа — `media.probe`, `media.transcode`, `media.capture` — v0 кроме capture

Реализуется несколькими взаимозаменяемыми backends: библиотека в процессе, поставляемый бинарь, удалённое исполнение.

```wit
interface media {
  record media-info {
    container: string,
    duration-ms: u64,
    streams: list<stream-info>,
    tags: list<tuple<string, string>>,
  }
  probe: func(path: string) -> result<media-info, error>;

  record video-target { codec: string, width: option<u32>, height: option<u32>, bitrate: option<u32>, fps: option<f32> }
  record audio-target { codec: string, bitrate: option<u32>, channels: option<u8>, sample-rate: option<u32> }
  record transcode-request {
    input: string,
    output: string,
    container: string,
    video: option<video-target>,
    audio: option<audio-target>,
    trim-start-ms: option<u64>,
    trim-end-ms: option<u64>,
  }

  resource job {
    progress: func() -> result<f32, error>;
    await-result: func() -> result<stat, error>;
    cancel: func();
  }
  transcode: func(req: transcode-request) -> result<job, error>;

  record backend-info {
    kind: string,                  // library | bundled | remote
    node: node-id,
    containers: list<string>,
    video-codecs: list<string>,
    audio-codecs: list<string>,
    hardware-acceleration: bool,
  }
  backend: func() -> result<backend-info, error>;
}
```

`backend()` обязателен к использованию перед построением запроса: набор кодеков различается между платформами, и приложение должно выбирать поддерживаемый вариант, а не получать ошибку в середине длинной операции.

Передача произвольных аргументов внешнему инструменту выделена в отдельное право `media.raw-args`, не входит в v0 и не переносима между платформами.

## Git — `vcs.git` — v0

Реализуется библиотекой в процессе, что делает возможной работу на Android без запуска процессов.

```wit
interface git {
  record signature { name: string, email: string }
  record commit-info { id: string, message: string, author: signature, at: instant }

  resource repo {
    status:   func() -> result<list<file-status>, error>;
    stage:    func(paths: list<string>) -> result<_, error>;
    commit:   func(message: string, author: signature) -> result<string, error>;
    log:      func(limit: u32) -> result<list<commit-info>, error>;
    branches: func() -> result<list<string>, error>;
    checkout: func(reference: string) -> result<_, error>;
    fetch:    func(remote: string) -> result<_, error>;
    pull:     func(remote: string, branch: string) -> result<_, error>;
    push:     func(remote: string, branch: string) -> result<_, error>;
  }

  open:  func(path: string) -> result<repo, error>;
  init:  func(path: string) -> result<repo, error>;
  clone: func(url: string, path: string) -> result<repo, error>;
}
```

Сетевые операции требуют дополнительно права на соответствующий хост, а учётные данные берутся из secrets service, а не передаются приложением в открытом виде.

Экзотические возможности Git, отсутствующие в библиотечной реализации, в переносимый контракт не входят.


## Процессы хоста — `process.exec:<program>`, `process.shell` — v0, класс администрирования, делегируемо

```wit
interface process {
  enum stdio { inherit-null, pipe }
  record spawn-options {
    program: string,
    args: list<string>,                        // отдельными элементами, не строкой
    env: list<tuple<string, string>>,          // явный список, наследования нет
    cwd: string,                               // путь VFS или внешнего монтирования
    stdin: stdio,
    stdout: stdio,
    stderr: stdio,
    timeout-ms: duration-ms,                   // обязателен
  }
  record exit-status { code: option<s32>, signal: option<s32>, timed-out: bool }

  resource child {
    stdin:  func() -> result<byte-writer, error>;
    stdout: func() -> result<byte-reader, error>;
    stderr: func() -> result<byte-reader, error>;
    wait:   func() -> result<exit-status, error>;
    kill:   func() -> result<_, error>;
  }

  spawn: func(opts: spawn-options) -> result<child, error>;

  record shell-options { command: string, cwd: string, timeout-ms: duration-ms }
  shell: func(opts: shell-options) -> result<child, error>;

  record shell-info { available: bool, kind: string }   // sh | cmd | powershell
  shell-kind: func() -> shell-info;
}
```

- `spawn` с массивом аргументов не подвержен инъекции и является переносимым способом;
- `shell` исполняет строку через оболочку хоста, платформозависим и требует отдельного права. `shell-kind` возвращает вид оболочки, различие не скрывается;
- окружение не наследуется; `cwd` обязан находиться внутри доступного компоненту поддерева;
- отмена execution завершает дочерний процесс и его группу;
- на Android оба метода возвращают `unavailable` для произвольных программ.

При удалённом исполнении право проверяется дважды: у инициатора — право делегировать, у целевого node — собственное правило для этого пакета и этой программы. Односторонней проверки недостаточно: иначе компрометация одного устройства даёт исполнение кода на всех остальных.

Различаются три права:

```text
process.exec:<program>   запуск конкретной программы
process.exec:*           запуск произвольных программ, класс администрирования
process.shell            исполнение строки через оболочку хоста, класс администрирования
```

`process.exec` не выдаётся приложениям по умолчанию ни в каком виде. Права класса администрирования требуют отдельного подтверждения и не могут быть получены обновлением пакета без согласия пользователя. Компонент, использующий `process.shell`, обязан объявить поддерживаемые платформы: переносимость такого вызова не гарантируется.

Внешние инструменты вроде FFmpeg и Git на Android доступны не через `process.exec`, а через собственные capabilities, описанные выше. Системный терминал K-OS — обычное системное приложение с правом класса администрирования, а не обходной путь: его наличие не даёт приложениям возможности запускать команды через него.
