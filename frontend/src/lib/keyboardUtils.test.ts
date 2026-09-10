import { describe, it, expect } from "vitest";
import {
  convertThaiToEnglishKey,
  capitalizeFirstLetter,
  formatTypeInput,
  hasThaiChar,
} from "./keyboardUtils";

describe("keyboardUtils", () => {
  describe("hasThaiChar", () => {
    it("detects Thai characters correctly", () => {
      expect(hasThaiChar("ผฟิิรป")).toBe(true);
      expect(hasThaiChar("zabbix")).toBe(false);
      expect(hasThaiChar("Zabbix123")).toBe(false);
    });
  });

  describe("convertThaiToEnglishKey", () => {
    it("converts Thai Kedmanee keys to English QWERTY", () => {
      expect(convertThaiToEnglishKey("ผฟิิรป")).toBe("zabbix");
      expect(convertThaiToEnglishKey("กฟะฟิฟหำ")).toBe("database");
      expect(convertThaiToEnglishKey("พีืินนา")).toBe("runbook");
      expect(convertThaiToEnglishKey("หนย")).toBe("sop");
      expect(convertThaiToEnglishKey("ดฟๆ")).toBe("faq");
      expect(convertThaiToEnglishKey("ยกด")).toBe("pdf");
      expect(convertThaiToEnglishKey("สรืา")).toBe("link");
    });

    it("leaves English and numbers untouched", () => {
      expect(convertThaiToEnglishKey("zabbix")).toBe("zabbix");
      expect(convertThaiToEnglishKey("Database-01")).toBe("Database-01");
    });
  });

  describe("capitalizeFirstLetter", () => {
    it("capitalizes the first letter", () => {
      expect(capitalizeFirstLetter("zabbix")).toBe("Zabbix");
      expect(capitalizeFirstLetter("database")).toBe("Database");
      expect(capitalizeFirstLetter("")).toBe("");
    });
  });

  describe("formatTypeInput", () => {
    it("converts Thai input and capitalizes first letter", () => {
      // User's explicit example: ผฟิิรป -> zabbix -> Zabbix
      expect(formatTypeInput("ผฟิิรป")).toBe("Zabbix");
      expect(formatTypeInput("พีืินนา")).toBe("Runbook");
      expect(formatTypeInput("กฟะฟิฟหำ")).toBe("Database");
    });

    it("handles lowercase English by capitalizing the first letter", () => {
      expect(formatTypeInput("zabbix")).toBe("Zabbix");
      expect(formatTypeInput("runbook")).toBe("Runbook");
      expect(formatTypeInput("database")).toBe("Database");
    });

    it("preserves acronyms and mixed case", () => {
      expect(formatTypeInput("SOP")).toBe("SOP");
      expect(formatTypeInput("FAQ")).toBe("FAQ");
      expect(formatTypeInput("CI/CD")).toBe("CI/CD");
    });
  });
});
