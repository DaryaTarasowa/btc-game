// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Modal } from "@/components/Modal/Modal";

afterEach(cleanup);

test("closes from Escape and backdrop interactions", () => {
  const onClose = vi.fn();
  render(
    <Modal onClose={onClose}>
      <h2 id="modal-title">Modal title</h2>
    </Modal>,
  );

  fireEvent.keyDown(window, { key: "Escape" });
  fireEvent.mouseDown(screen.getByRole("presentation"));

  expect(onClose).toHaveBeenCalledTimes(2);
});

test("prevents closing while close interactions are disabled", () => {
  const onClose = vi.fn();
  render(
    <Modal closeDisabled onClose={onClose}>
      <h2 id="modal-title">Modal title</h2>
    </Modal>,
  );

  fireEvent.keyDown(window, { key: "Escape" });
  fireEvent.mouseDown(screen.getByRole("presentation"));

  expect(onClose).not.toHaveBeenCalled();
});
