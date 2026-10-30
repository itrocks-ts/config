import { appDir }       from '@itrocks/app-dir'
import { dependencies } from '@itrocks/dependency'
import { readFile }     from 'node:fs/promises'
import { dirname }      from 'node:path'
import { join }         from 'node:path'
import { resolve }      from 'node:path'
import { parse }        from 'yaml'

export type Config = Record<string, any>

export const config: Config = {}

const pathSources = new Map<string, { path: string; value: unknown }>()

export function configPath(name: string, fallback: string): string
{
	const value = config[name] ?? fallback
	if (typeof value !== 'string') throw new TypeError(`Configuration ${name} must be a path`)
	const source = pathSources.get(name)
	return config[name] !== undefined && source?.value === value ? source.path : resolve(appDir, value)
}

async function loadDir(path: string, relativePathSlice = 0)
{
	await loadFile(join(path, 'config.yaml'), relativePathSlice)
	await loadFile(join(path, 'local.yaml'), relativePathSlice)
}

async function loadFile(file: string, relativePathSlice = 0)
{
	let yaml: string
	try {
		yaml = await readFile(file, 'utf-8')
	}
	catch {
		return
	}
	loadYaml(yaml, relativePathSlice ? dirname(file).slice(relativePathSlice) : dirname(file), dirname(file))
}

function loadYaml(buffer: string, path: string, sourceDirectory: string)
{
	const values = parse(buffer)
	mergeConfig(config, values, path)
	for (const [key, value] of Object.entries(values)) {
		if (typeof value === 'string') {
			pathSources.set(key, { path: resolve(sourceDirectory, value), value: config[key] })
		}
		else pathSources.delete(key)
	}
}

function mergeConfig(config: Config, merge: Config, path: string, prepend = false, depth = 0)
{
	const entries = prepend
		? Object.entries(config)
		: undefined
	if (entries) {
		for (const key in config) {
			delete config[key]
		}
	}
	Object.entries(merge).forEach(([key, value]) => {
		if (key === '') {
			if (value === null) {
				for (const key in config) {
					delete config[key]
				}
			}
			return
		}
		if (value === null) {
			delete config[key]
			return
		}
		const pathValue = (value: string) => ((typeof value === 'string') && value.startsWith('./'))
			? (path + value.slice(1))
			: value
		if (!(key in config)) {
			config[key] = pathValue(value)
			return
		}
		if (Array.isArray(value)) {
			if (!Array.isArray(config[key])) {
				config[key] = [config[key]]
			}
			config[key].push(...value.map(pathValue))
			return
		}
		if (Array.isArray(config[key])) {
			config[key].push(pathValue(value))
			return
		}
		if (typeof config[key] === 'object') {
			mergeConfig(config[key], value, path, depth ? false : (key === 'menu'), depth + 1)
			return
		}
		config[key] = pathValue(value)
	})
	if (entries) {
		for (const [key, value] of entries) {
			config[key] = ((typeof config[key] === 'object') && (typeof value === 'object'))
				? {...config[key], ...value }
				: value
		}
	}
}

async function scanModules(path: string, relativePathSlice = 0)
{
	for (const module of await dependencies(path)) {
		await loadDir(join(path, 'node_modules', module), relativePathSlice)
	}
}

export async function scanConfigFiles(path = appDir)
{
	const relativePathSlice = path.startsWith(appDir) ? appDir.length : 0
	await scanModules(path, relativePathSlice)
	await loadDir(path, relativePathSlice)
}
