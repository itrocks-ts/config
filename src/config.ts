import { appDir }       from '@itrocks/app-dir'
import { dependencies } from '@itrocks/dependency'
import { readFile }     from 'node:fs/promises'
import { dirname }      from 'node:path'
import { join }         from 'node:path'
import { parse }        from 'yaml'

export type Config = Record<string, any>

export const config: Config = {}

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
	loadYaml(yaml, relativePathSlice ? dirname(file).slice(relativePathSlice) : dirname(file))
}

function loadYaml(buffer: string, path: string)
{
	mergeConfig(config, parse(buffer), path)
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
			config[key] = value
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
