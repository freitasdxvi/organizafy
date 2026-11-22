import { expect, it } from "vitest";
import { integrationReturnPath } from "./integration-return";
it("preserves only the integration destination and canonical handle", () => {
  expect(integrationReturnPath("/persiste/integracao?expected_username=%40Same.Account&token=discard"))
    .toBe("/persiste/integracao?expected_username=same.account");
  expect(integrationReturnPath("/avanca/integracao?expected_username=same.account"))
    .toBe("/persiste/integracao?expected_username=same.account");
});
it("rejects external, malformed and unrelated destinations", () => {
  for (const path of [undefined, {}, "https://evil.test/persiste/integracao", "//evil.test/persiste/integracao", "/\\evil.test/persiste/integracao", "/persiste/config", "/persiste/integracao#token", "javascript:alert(1)"]) {
    expect(integrationReturnPath(path)).toBe("/persiste");
  }
});
it("discards malformed handles without treating them as identity", () => {
  expect(integrationReturnPath("/persiste/integracao?expected_username=bad%26account")).toBe("/persiste/integracao");
});
