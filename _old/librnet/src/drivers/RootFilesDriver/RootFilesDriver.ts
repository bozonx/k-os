import type { System } from '@/system/System.js'
import { DriverFactoryBase } from '@/system/base/DriverFactoryBase.js'
import DriverInstanceBase from '@/system/base/DriverInstanceBase.js'
import { checkPermissions } from '@/system/helpers/CheckPathPermission.js'
import { clearAbsolutePath } from '@/system/helpers/helpers.js'
import { IoNames } from '@/types/EntitiesNames.js'
import type { FilesDriverType } from '@/types/FilesDriverType'
import { type DriverManifest } from '@/types/Manifests.js'
import type {
  AccessMode,
  CopyOptions,
  GlobOptions,
  MkdirOptions,
  ReadBinFileOptions,
  ReadTextFileOptions,
  ReaddirOptions,
  RmOptions,
  StatsSimplified,
  WriteFileOptions,
} from '@/types/io/FilesIoType.js'
import { type BinTypes, type DriverIndex, FileActions } from '@/types/types.js'

export const FILE_PERM_DELIMITER = '|'

export const RootFilesDriverIndex: DriverIndex = (
  manifest: DriverManifest,
  system: System
) => {
  return new RootFilesDriver(system, manifest)
}

export class RootFilesDriver extends DriverFactoryBase<
  RootFilesDriverInstance,
  RootFilesDriverProps
> {
  readonly requireIo = [IoNames.LocalFilesIo]
  protected SubDriverClass = RootFilesDriverInstance
}

export interface RootFilesDriverProps {
  entityWhoAsk: string
}

/**
 * Access to the root files of the system
 *
 * - Does check permissions
 * - Does all of RootDirAccess: resolve real path and mount points, Use uid and
 *   gid
 * - Does all of FilesDriverLogic: Emits events etc
 */
export class RootFilesDriverInstance
  extends DriverInstanceBase<RootFilesDriverProps, Record<string, any>>
  implements FilesDriverType
{
  private get files() {
    return this.system.localFiles
  }

  ////// READ ONLY METHODS
  async readTextFile(
    pathTo: string,
    options?: ReadTextFileOptions
  ): Promise<string> {
    await this.checkPermissions(pathTo, FileActions.read)
    return await this.files.readTextFile(pathTo, options)
  }

  async readBinFile(
    pathTo: string,
    options?: ReadBinFileOptions
  ): Promise<BinTypes> {
    await this.checkPermissions(pathTo, FileActions.read)
    return await this.files.readBinFile(pathTo, options)
  }

  async stat(pathTo: string): Promise<StatsSimplified | undefined> {
    await this.checkPermissions(pathTo, FileActions.read)
    return await this.files.stat(pathTo)
  }

  async exists(pathTo: string): Promise<boolean> {
    await this.checkPermissions(pathTo, FileActions.read)
    return await this.files.exists(pathTo)
  }

  async readdir(pathTo: string, options?: ReaddirOptions): Promise<string[]> {
    await this.checkPermissions(pathTo, FileActions.read)

    return await this.files.readdir(pathTo, options)
  }

  async readlink(pathTo: string): Promise<string> {
    await this.checkPermissions(pathTo, FileActions.read)
    return await this.files.readlink(pathTo)
  }

  async isTextFileUtf8(pathTo: string): Promise<boolean> {
    await this.checkPermissions(pathTo, FileActions.read)
    return await this.files.isTextFileUtf8(pathTo)
  }

  async glob(
    pattern: string | string[],
    options?: GlobOptions
  ): Promise<string[]> {
    // TODO: how to check permissions more precisely?
    const result = await this.files.glob(pattern, options)

    await this.checkPermissions(result, FileActions.read)

    return result
  }

  async realpath(pathTo: string): Promise<string> {
    await this.checkPermissions(pathTo, FileActions.read)
    const result = await this.files.realpath(pathTo)
    await this.checkPermissions(result, FileActions.read)
    return result
  }

  async access(pathTo: string, mode?: AccessMode): Promise<boolean> {
    await this.checkPermissions(pathTo, FileActions.read)
    return await this.files.access(pathTo, mode)
  }

  async isDir(pathToDir: string): Promise<boolean> {
    await this.checkPermissions(pathToDir, FileActions.read)
    return await this.files.isDir(pathToDir)
  }

  async isFile(pathToFile: string): Promise<boolean> {
    await this.checkPermissions(pathToFile, FileActions.read)
    return await this.files.isFile(pathToFile)
  }

  async isSymLink(pathToSymLink: string): Promise<boolean> {
    await this.checkPermissions(pathToSymLink, FileActions.read)
    return await this.files.isSymLink(pathToSymLink)
  }

  ////// WRITE METHODS
  async appendFile(
    pathTo: string,
    data: string,
    options?: WriteFileOptions
  ): Promise<void> {
    await this.checkPermissions(pathTo, FileActions.write)
    await this.files.appendFile(pathTo, data, options)
  }

  async writeFile(
    pathTo: string,
    data: string | Uint8Array,
    options?: WriteFileOptions
  ): Promise<void> {
    await this.checkPermissions(pathTo, FileActions.write)
    await this.files.writeFile(pathTo, data, options)
  }

  async rm(paths: string[], options?: RmOptions): Promise<void> {
    await this.checkPermissions(paths, FileActions.write)
    await this.files.rm(paths, options)
  }

  async cp(files: [string, string][], options?: CopyOptions): Promise<void> {
    await this.checkPermissions(
      files.map(([src]) => src),
      FileActions.read
    )
    await this.checkPermissions(
      files.map(([, dest]) => dest),
      FileActions.write
    )

    await this.files.cp(files, options)
  }

  async rename(files: [string, string][]): Promise<void> {
    await this.checkPermissions(files.flat(), FileActions.write)
    await this.files.rename(files)
  }

  async mkdir(pathTo: string, options?: MkdirOptions): Promise<void> {
    await this.checkPermissions(pathTo, FileActions.write)
    await this.files.mkdir(pathTo, options)
  }

  /**
   * Target and dest have to have write permissions
   *
   * @param target
   * @param pathTo
   * @returns
   */
  async link(target: string, pathTo: string): Promise<void> {
    await this.checkPermissions(target, FileActions.read)
    await this.checkPermissions(pathTo, FileActions.write)
    await this.files.link(target, pathTo)
  }

  async utimes(
    pathTo: string,
    atime: number | string,
    mtime: number | string
  ): Promise<void> {
    await this.checkPermissions(pathTo, FileActions.write)
    await this.files.utimes(pathTo, atime, mtime)
  }

  async truncate(pathTo: string, len: number = 0): Promise<void> {
    await this.checkPermissions(pathTo, FileActions.write)
    await this.files.truncate(pathTo, len)
  }

  async chown(pathTo: string, uid: number, gid: number): Promise<void> {
    await this.checkPermissions(pathTo, FileActions.write)
    await this.files.chown(pathTo, uid, gid)
  }

  async chmod(pathTo: string, mode: number): Promise<void> {
    await this.checkPermissions(pathTo, FileActions.write)
    await this.files.chmod(pathTo, mode)
  }

  ////////// ADDITIONAL

  async copyToDest(
    src: string | string[],
    destDir: string,
    force?: boolean
  ): Promise<void> {
    await this.checkPermissions(src, FileActions.read)
    await this.checkPermissions(destDir, FileActions.write)
    await this.files.copyToDest(src, destDir, force)
  }

  async moveToDest(
    src: string | string[],
    destDir: string,
    force?: boolean
  ): Promise<void> {
    await this.checkPermissions(src, FileActions.write)
    await this.checkPermissions(destDir, FileActions.write)
    await this.files.moveToDest(src, destDir, force)
  }

  async renameFile(file: string, newName: string): Promise<void> {
    if (newName.includes('/') || newName.includes('\\')) {
      throw new Error('New name cannot contain slashes')
    }

    await this.checkPermissions(file, FileActions.write)
    await this.files.renameFile(file, newName)
  }

  async rmRf(pathToFileOrDir: string): Promise<void> {
    await this.checkPermissions(pathToFileOrDir, FileActions.write)
    await this.files.rmRf(pathToFileOrDir)
  }

  async mkDirP(pathToDir: string): Promise<void> {
    await this.checkPermissions(pathToDir, FileActions.write)
    await this.files.mkDirP(pathToDir)
  }

  protected async checkPermissions(paths: string | string[], action: string) {
    // TODO: review
    const preparedPath = clearAbsolutePath(pathTo)

    await checkPermissions(
      this.system.permissions.checkPermissions.bind(this.system.permissions),
      this.props.entityWhoAsk,
      this.driverFactory.name,
      paths,
      action
    )
  }
}
