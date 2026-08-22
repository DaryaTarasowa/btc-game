// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { DropdownMenu } from "@/components/DropdownMenu/DropdownMenu";

afterEach(cleanup);

function renderDropdown(onTriggerClick = vi.fn(), closeOnSelect = true) {
  const onSelect = vi.fn();

  render(
    <DropdownMenu
      trigger="Account"
      triggerClassName="trigger-style"
      ariaLabel="Account actions"
      onTriggerClick={onTriggerClick}
      actions={[
        {
          label: "Menu action",
          closeOnSelect,
          onSelect,
        },
      ]}
    />,
  );

  return { onTriggerClick, onSelect };
}

test("toggles the menu from its trigger and closes after selecting an action", () => {
  const { onTriggerClick, onSelect } = renderDropdown();

  const trigger = screen.getByRole("button", { name: "Account" });

  fireEvent.click(trigger);

  expect(onTriggerClick).toHaveBeenCalledOnce();
  expect(screen.getByRole("dialog", { name: "Account actions" })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Menu action" }));

  expect(onSelect).toHaveBeenCalledOnce();
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("keeps the menu open when closeOnSelect is false", () => {
  const { onSelect } = renderDropdown(vi.fn(), false);

  fireEvent.click(screen.getByRole("button", { name: "Account" }));

  fireEvent.click(screen.getByRole("button", { name: "Menu action" }));

  expect(onSelect).toHaveBeenCalledOnce();
  expect(screen.getByRole("dialog", { name: "Account actions" })).toBeTruthy();
});

test("closes from Escape and outside clicks", () => {
  renderDropdown();

  const trigger = screen.getByRole("button", { name: "Account" });

  fireEvent.click(trigger);
  fireEvent.keyDown(window, { key: "Escape" });

  expect(screen.queryByRole("dialog")).toBeNull();

  fireEvent.click(trigger);
  fireEvent.mouseDown(document.body);

  expect(screen.queryByRole("dialog")).toBeNull();
});
