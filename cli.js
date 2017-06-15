#!/usr/bin/env node
'use strict';
const arrify = require('arrify');
const meow = require('meow');
const getStdin = require('get-stdin');
const imagemin = require('imagemin');
const ora = require('ora');
const plur = require('plur');
const stripIndent = require('strip-indent');
const fs = require('fs')
const path = require('path')

console.log('début process');

const cli = meow(`
    /** by default will minify and override all the existing images in all subfolders **/

	Usage
	  $ imagemin <path|glob> [--plugin=<name> ...]
	  $ cat <file> | imagemin > <output>
	  
	  Options
	  -p, --plugin   Override the default plugins
	  -o, --out-dir  Output directory

	Examples
	  $ imagemin images/*
	  

`, {
    string: [
        'plugin',
        'out-dir'
    ],
    alias: {
        p: 'plugin',
        o: 'out-dir'
    }
});

const DEFAULT_PLUGINS = [
    'gifsicle',
    'jpegtran',
    'optipng',
    'svgo'
];

const requirePlugins = plugins => plugins.map(x => {
    try {
        return require(`imagemin-${x}`)();
    } catch (err) {
        console.error(stripIndent(`
			Unknown plugin: ${x}

			Did you forgot to install the plugin?
			You can install it with:

			  $ npm install -g imagemin-${x}
		`).trim());
        process.exit(1);
    }
});

const processImagemin = (input, dir, opts) => {
    imagemin(input, dir, opts)
        .then(files => {
            if (!dir && files.length === 0) {
                return;
            }

            if (!dir && files.length > 1) {
                console.error('Cannot write multiple files to stdout');
                process.exit(1);
            }

            if (!dir) {
                process.stdout.write(files[0].data);
                return;
            }

            console.log(`${files.length} ${plur('image', files.length)} minified in ${dir}`);
        })
        .catch(err => {
            throw err;
        });
}

const run = (input, opts) => {

    opts = Object.assign({plugin: DEFAULT_PLUGINS}, opts);

    const use = requirePlugins(arrify(opts.plugin));
    const spinner = ora('Minifying images');

    if (Buffer.isBuffer(input)) {
        imagemin.buffer(input, {use}).then(buf => process.stdout.write(buf));
        return;
    }

    if (!fs.lstatSync(input[0]).isDirectory()) {
        processImagemin(input, opts.outDir, {use})
    } else {

        let getAllDirectories = srcpath => {
            let directories = [srcpath]
            let getDirectories = srcpath => {
                let folders = fs.readdirSync(srcpath).filter(file => fs.lstatSync(path.join(srcpath, file)).isDirectory())
                if (folders.length !== 0) {
                    for (let i = 0; i < folders.length; i++) {
                        directories.push(srcpath + '/' + folders[i])
                        getDirectories(srcpath + '/' + folders[i])
                    }
                }
            }
            getDirectories(srcpath)
            return directories
        }
        let dirs = getAllDirectories(input[0]);

        for (let i = 0; i < dirs.length; i++) {

            input = [dirs[i] + '/*']

            if (!opts.outDir) {
                opts.outDir = dirs[i];
            }

            /**
             * lancement d'imagemin
             */
            processImagemin(input, dirs[i], {use})
        }
    }
};

if (!cli.input.length && process.stdin.isTTY) {
    console.error('Specify at least one filename');
    process.exit(1);
}

if (cli.input.length) {
    run(cli.input, cli.flags);
} else {
    getStdin.buffer().then(buf => run(buf, cli.flags));
}
