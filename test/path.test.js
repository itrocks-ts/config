const assert = require('node:assert/strict')
const { mkdtemp, mkdir, rm, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const { test } = require('node:test')
const { appDir } = require('@itrocks/app-dir')
const { config, configPath, scanConfigFiles } = require('../cjs/config.js')

test('configuration paths retain their declaring directory through overrides', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'config-path-'))
	try {
		await mkdir(join(directory, 'node_modules'))
		await writeFile(join(directory, 'package.json'), '{"dependencies":{}}')
		for (const value of ['./storage', '../data', '/tmp/absolute-data']) {
			await writeFile(join(directory, 'config.yaml'), `dataPath: ${value}\n`)
			await scanConfigFiles(directory)
			assert.equal(configPath('dataPath', '../data'), resolve(directory, value))
		}
		await writeFile(join(directory, 'local.yaml'), 'dataPath: ./local-storage\n')
		await scanConfigFiles(directory)
		assert.equal(configPath('dataPath', '../data'), join(directory, 'local-storage'))
		delete config.dataPath
		assert.equal(configPath('dataPath', '../data'), resolve(appDir, '../data'))
		config.dataPath = './programmatic'
		assert.equal(configPath('dataPath', '../data'), resolve(appDir, 'programmatic'))
	}
	finally { delete config.dataPath; await rm(directory, { force: true, recursive: true }) }
})
