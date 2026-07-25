import { getClientInfoFactory } from "@/common/client-info";

function main(): void {
  SV.showMessageBox("Hello World", "Hello World!");
  SV.finish();
}

globalThis.getClientInfo = getClientInfoFactory("Hello World");
globalThis.main = main;
