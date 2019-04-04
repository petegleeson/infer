# infer

A static type checker for Javascript based on type inference. Here it is in action.

![](https://i.imgur.com/6vJtIJq.gif)

**^^ Watch the the owl! 🦉**

## What is this?

This project aims to be an alternative to the static typing tools that exist in the JavaScript ecosystem. The main goal of the project is to provide static type safety without the need for type annotations.

This project is broken up into three packages. The `core` package contains all the type inference logic. The `server` package is an lsp that uses `core` to run type inference on a file. The `client` package is a vscode addon that renders the owl in the vscode editor.

## What does it do?

At the moment it has basic support for:

- Numbers
- String
- Objects
- Functions (expressions only)
- Function application
- Variable assignment
- Basic error detection

![](https://i.imgur.com/XJWqCVl.gif)

## Should I use this?

No. This is a personal project that is far from ready to be used in the large.

## Running the project

First you need to install `bolt`:

```
yarn global add bolt
```

Then you will need to build the core package run:

```
bolt build
```

Then in vscode go to the debug tab and select the "Launch Client" option.
