import { FilesDriverLogic } from '../driversLogic/FilesDriverLogic.js'
import { System } from '@/system/System.js'
import type { IoBase } from '@/system/base/IoBase.js'
import { resolveRealPath } from '@/system/helpers/helpers.js'
import { IoNames } from '@/types/EntitiesNames.js'
import type { FilesEventData } from '@/types/EventsData.js'
import { SYSTEM_ENTITY } from '@/types/constants.js'
import type { FilesIoType } from '@/types/io/FilesIoType.js'
import { SystemEvents } from '@/types/types.js'

export class RootDirAccess extends FilesDriverLogic {
  constructor(protected readonly system: System) {
    super(
      SYSTEM_ENTITY,
      system.ios.getIo<FilesIoType & IoBase>(IoNames.LocalFilesIo),
      system.env.FILES_UID,
      system.env.FILES_GID
    )
  }

  protected riseEvent(event: FilesEventData): void {
    this.system.events.emit(SystemEvents.localFiles, event)
  }

  // Make real path on external file system
  protected preparePath(pathTo: string): string {
    // TODO: путь должен быть абсолютным и не содежать ../
    const preparedPath = clearAbsolutePath(pathTo)
    // TODO: review
    // TODO: очищать от urls и относительных путей
    return resolveRealPath(
      pathTo,
      this.system.mountPoints.rootDir,
      this.system.mountPoints.getMountPoints()
    )
  }
}
