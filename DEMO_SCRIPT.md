# Final Defense Demo Script

## Demo goal

Use a short set of commands to show that the project already behaves like a small but complete CLI framework.

## Demo order

1. Show test coverage
2. Show basic subcommand parsing
3. Show variadic options and negatable options
4. Show help and error behavior
5. Show default subcommand behavior
6. Show standalone executable subcommands

## Demo commands

### 1. Run the full test suite

```bash
cd D:\Desktop\中期\commander.js
node --test
```

Talking point:

- This proves the parser behavior is backed by automated verification rather than manual screenshots.

### 2. Show normal subcommand parsing

```bash
node examples/string-util.js split --separator=/ a/b/c
```

Expected result:

```json
["a","b","c"]
```

Talking point:

- This demonstrates standard subcommand dispatch plus regular value options.

### 3. Show variadic option support

```bash
node examples/string-util.js split --list a b c
```

Expected result:

```json
["a","b","c"]
```

Talking point:

- The `--list` option is variadic, so one option can collect multiple values.

### 4. Show richer release example

```bash
node examples/release.js ship app.tar.gz build-17 -t abc123 --tag stable beta --no-color
```

Expected result:

```json
{"artifact":"app.tar.gz","build":"build-17","environment":"production","tags":["stable","beta"],"color":false,"verbose":false,"tokenLength":6}
```

Talking points:

- `--tag` demonstrates variadic options.
- `--no-color` demonstrates negatable boolean options.
- `ship` demonstrates arguments, required options, and action handler output.

### 5. Show help-after-error behavior

```bash
node -e "import('./src/index.js').then(({Command})=>{const program=new Command().name('demo').description('Demo CLI').option('--first','first only').showHelpAfterError(); try{program.parse(['--firts'],{from:'user'});}catch(err){console.log(err.message);}})"
```

Expected behavior:

- Output begins with `error: Unknown option: --firts`
- Output also contains a suggestion and usage/help text

Talking point:

- This shows the project now includes command-line usability work, not only raw parsing.

### 6. Show default subcommand behavior

```bash
node -e "import('./src/index.js').then(({Command})=>{let result=null; const program=new Command().name('string-util'); program.command('split <input>', { isDefault: true }).option('-s, --separator <char>','separator',',').action((input, options)=>{result=input.split(options.separator); console.log(JSON.stringify(result));}); program.parse(['a/b/c','-s','/'],{from:'user'});})"
```

Expected result:

```json
["a","b","c"]
```

Talking point:

- Even without explicitly typing the subcommand name, the framework can route to a default command.

### 7. Show standalone executable subcommands

```bash
node examples/service.js start api --port 3000 --tag blue green
node examples/service-async.js check gateway --verbose
```

Expected results:

```json
{"name":"api","port":"3000","tags":["blue","green"]}
{"service":"gateway","status":"healthy","verbose":true}
```

Talking points:

- `service.js` demonstrates convention-based external subcommand lookup through `.executableDir()`.
- `service-async.js` demonstrates explicit executable registration through `.executableFile()`.
- The second command also proves that external subcommands work in the `parseAsync()` flow.

## Suggested speaking outline

### Opening

- I selected `commander.js` because it is a widely used Node.js CLI framework with a concentrated and demonstrable core architecture.

### Midterm to final progress

- The midterm version mainly completed the parser core.
- The final version expands the framework into a much more complete CLI toolchain with stronger API coverage and better user experience.

### Technical highlights

- parser completeness: options, arguments, subcommands, aliases, required values, variadic values
- usability: help generation, suggestions, formatted errors, help-after-error
- API improvements: `.arguments()`, `.addCommand()`, custom processors, default subcommands, standalone executable subcommands

### Closing

- The current rewrite is no longer only a partial prototype; it is already a usable miniature CLI framework with tests, examples, and synchronized documentation.

## Backup commands if asked additional questions

### Show custom help conflict handling

```bash
node -e "import('./src/index.js').then(({Command})=>{const program=new Command().name('demo').option('-h, --human','human').option('--first','first'); console.log(program.helpInformation());})"
```

### Show custom argument processing

```bash
node -e "import('./src/index.js').then(({Command})=>{const program=new Command().argument('<port>','port',(value)=>Number(value)); program.parse(['3000'],{from:'user'}); console.log(JSON.stringify(program.args));})"
```

### Show standalone executable subcommand help entry

```bash
node examples/service.js --help
```
