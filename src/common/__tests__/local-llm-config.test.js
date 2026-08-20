import { describe, it, expect } from 'vitest';
import {
  normalizePort,
  buildLocalEndpoint,
  parseExtraParams,
  LOCAL_LLM_DEFAULT_PORT,
} from '../local-llm-config.js';

describe('local-llm-config helpers', () => {
  describe('normalizePort', () => {
    it('should pass through valid ports', () => {
      expect(normalizePort(8080)).toBe(8080);
      expect(normalizePort('11434')).toBe(11434);
    });

    it('should fall back to the default for non-numeric input', () => {
      expect(normalizePort('abc')).toBe(LOCAL_LLM_DEFAULT_PORT);
      expect(normalizePort(NaN)).toBe(LOCAL_LLM_DEFAULT_PORT);
      expect(normalizePort('')).toBe(LOCAL_LLM_DEFAULT_PORT);
    });

    it('should clamp out-of-range values', () => {
      expect(normalizePort(0)).toBe(1);
      expect(normalizePort(-5)).toBe(1);
      expect(normalizePort(70000)).toBe(65535);
      expect(normalizePort(65536)).toBe(65535);
    });
  });

  describe('buildLocalEndpoint', () => {
    it('should build the OpenAI-style endpoint from a port', () => {
      expect(buildLocalEndpoint(8080)).toBe('http://127.0.0.1:8080/v1');
      expect(buildLocalEndpoint(5001)).toBe('http://127.0.0.1:5001/v1');
    });
  });

  describe('parseExtraParams', () => {
    it('should return {} for blank input', () => {
      expect(parseExtraParams('')).toEqual({});
      expect(parseExtraParams('   ')).toEqual({});
    });

    it('should parse a JSON object', () => {
      expect(parseExtraParams('{"model":"qwen3.8","temperature":0.6}')).toEqual({
        model: 'qwen3.8',
        temperature: 0.6,
      });
    });

    it('should throw on invalid JSON', () => {
      expect(() => parseExtraParams('{oops')).toThrow('not valid JSON');
    });

    it('should throw on non-object JSON', () => {
      expect(() => parseExtraParams('[1,2]')).toThrow('single JSON object');
      expect(() => parseExtraParams('"hello"')).toThrow('single JSON object');
    });
  });
});