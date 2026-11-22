import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PersisteMascot } from "./PersisteMascot";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("rotates marketing messages without blocking the dashboard", () => {
  vi.useFakeTimers();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  render(<PersisteMascot totalViews={1_000_000} viewsOnNewReels={10_000} />);
  const pico = screen.getByRole("button", { name: "Conversar com Pico" });
  expect(pico).toBeVisible();
  expect(pico).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(12_000));
  expect(screen.getByRole("status")).toHaveTextContent("1M de vizu? Me vende mentoria?");
  fireEvent.click(screen.getByRole("button", { name: "Dispensar mensagem do Pico" }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(pico).toHaveFocus();
  act(() => vi.advanceTimersByTime(123_000));
  expect(screen.getByRole("status")).toHaveTextContent("10k nos Reels de hoje");
  act(() => vi.advanceTimersByTime(16_000));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(pico).toBeVisible();
});

it("talks on demand and keeps the current message open until dismissed", () => {
  vi.useFakeTimers();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  render(<PersisteMascot totalViews={null} viewsOnNewReels={0} />);
  const pico = screen.getByRole("button", { name: "Conversar com Pico" });
  fireEvent.click(pico);
  expect(screen.getByRole("status")).toHaveTextContent("Como tá o faturamento do dia?");
  fireEvent.click(pico);
  expect(screen.getByRole("status")).toHaveTextContent("Qual gancho");
  act(() => vi.advanceTimersByTime(135_000));
  expect(screen.getByRole("status")).toHaveTextContent("Qual gancho");
  fireEvent.keyDown(pico, { key: "Escape" });
  expect(pico).toHaveAttribute("aria-expanded", "false");
  expect(pico).toBeVisible();
});
