interface ClientInfoOptions {
  versionNumber?: number;
  minEditorVersion?: number;
  type?: string;
}

export function getClientInfoFactory(
  name: string,
  options?: ClientInfoOptions,
): () => SVClientInfo {
  return () => {
    const info: SVClientInfo = {
      name,
      category: "0x1F956",
      author: "0x1F320",
      versionNumber: options?.versionNumber ?? 1,
      minEditorVersion: options?.minEditorVersion ?? 0,
    };
    if (options?.type !== undefined) {
      info.type = options.type;
    }
    return info;
  };
}
