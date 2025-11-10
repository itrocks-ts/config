import { appDir }   from '@itrocks/app-dir'
import { readdir }  from 'node:fs/promises'
import { readFile } from 'node:fs/promises'
import { dirname }  from 'node:path'
import { join }     from 'node:path'
import { parse }    from 'yaml'

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

function mergeConfig(config: Config, merge: Config, path: string)
{
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
			mergeConfig(config[key], value, path)
			return
		}
		config[key] = pathValue(value)
	})
}

async function scanModules(path: string, relativePathSlice = 0)
{
	const entries = await readdir(path, { withFileTypes: true })
	await Promise.all(entries.map(async entry => {
		if (!entry.isDirectory()) {
			return
		}
		if (entry.name[0] === '@') {
			await scanModules(join(path, entry.name), relativePathSlice)
			return
		}
		await loadDir(join(path, entry.name), relativePathSlice)
	}))
}

export async function scanConfigFiles(path = appDir)
{
	const relativePathSlice = path.startsWith(appDir) ? appDir.length : 0
	await scanModules(join(path, 'node_modules'), relativePathSlice)
	await loadDir(path, relativePathSlice)
}
