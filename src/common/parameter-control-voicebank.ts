import { parseJsonValue, trimAsciiWhitespace } from "./parameter-control-targets";

export interface SavedVoiceReference {
  trackGroupId: string;
  groupId: string;
  offset: number;
  name: string;
}

function record(value: unknown): { [key: string]: unknown } {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as { [key: string]: unknown })
    : {};
}

function databaseName(reference: { [key: string]: unknown }): string {
  const name = record(reference.database).name;
  return typeof name === "string" ? trimAsciiWhitespace(name) : "";
}

export function savedVoiceReferences(text: string): SavedVoiceReference[] {
  // Native SVP files can end in a NUL byte.
  const end = text.indexOf("\0");
  const project = record(parseJsonValue(end >= 0 ? text.substring(0, end) : text));
  const result: SavedVoiceReference[] = [];
  if (!Array.isArray(project.tracks)) {
    return result;
  }
  project.tracks.forEach((value) => {
    const track = record(value);
    const main = record(track.mainRef);
    if (typeof main.groupID !== "string") {
      return;
    }
    const trackGroupId = main.groupID;
    const references = [main, ...(Array.isArray(track.groups) ? track.groups : [])];
    references.forEach((value) => {
      const reference = record(value);
      if (reference.isInstrumental === true || typeof reference.groupID !== "string") {
        return;
      }
      const ownName = databaseName(reference);
      result.push({
        trackGroupId,
        groupId: reference.groupID,
        offset: typeof reference.blickOffset === "number" ? reference.blickOffset : 0,
        // Empty strings are truthy in Lua; test length before inheriting the track voice.
        name: ownName.length > 0 ? ownName : databaseName(main),
      });
    });
  });
  return result;
}

export function savedVoicebankName(
  references: SavedVoiceReference[],
  trackGroupId: string,
  groupId: string,
  offset: number,
): string | undefined {
  const matches = references.filter(
    (reference) =>
      reference.trackGroupId === trackGroupId &&
      reference.groupId === groupId &&
      reference.offset === offset,
  );
  const name = matches[0]?.name;
  return name !== undefined &&
    name.length > 0 &&
    matches.every((reference) => reference.name === name)
    ? name
    : undefined;
}

export function legacyGroupsForVoicebank(
  references: SavedVoiceReference[],
  name: string,
): string[] {
  const ids: string[] = [];
  references.forEach((reference) => {
    if (
      reference.name === name &&
      ids.indexOf(reference.groupId) < 0 &&
      references.every((other) => other.groupId !== reference.groupId || other.name === name)
    ) {
      ids.push(reference.groupId);
    }
  });
  return ids;
}
