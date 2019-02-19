// add support using "window/showStatus" lsp extension
import * as lsp from "vscode-languageclient";
import { window, StatusBarAlignment } from "vscode";
// import StatusProvider from "./StatusProvider";
// import Status from "./Status";
// import { type ShowStatusParams, LspMessageType } from "./types";
// import StatusBarWidget from "../StatusBarWidget";

type StaticFeature = lsp.StaticFeature;

export default class StatusFeature implements StaticFeature {
  client: lsp.LanguageClient;

  constructor(client: lsp.LanguageClient) {
    this.client = client;
  }

  fillClientCapabilities(capabilities: lsp.ClientCapabilities): void {}

  initialize() {
    const myStatusBarItem = window.createStatusBarItem(
      StatusBarAlignment.Right,
      100
    );
    myStatusBarItem.text = "initializing...";
    myStatusBarItem.show();
    this.client.onRequest("custom/typeChanged", type => {
      myStatusBarItem.text = `🦉: ${type}`;
    });
    this.client.onReady().then(() => {
      window.onDidChangeTextEditorSelection(x => {
        const uri = x.textEditor.document.uri.toString();
        const { line, character } = x.selections[0].active;
        this.client.sendRequest("custom/selectionChanged", {
          uri,
          line,
          character
        });
        myStatusBarItem.text = `🦉: <none>`;
        myStatusBarItem.show();
      });
    });
    return myStatusBarItem;
  }
}
