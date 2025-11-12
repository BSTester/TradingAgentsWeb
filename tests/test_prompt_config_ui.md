# Prompt Config UI Testing Checklist

## Test Environment
- Browser: Chrome/Firefox/Safari
- Screen: Desktop/Tablet/Mobile
- User: Logged in with valid token

---

## 1. Character Count Display

### Test 1.1: Initial Load
- [ ] Open Prompt Config tab
- [ ] Verify character count shows next to "系统提示词" label
- [ ] Count should match the length of loaded prompt
- [ ] Format should use thousand separator (e.g., "2,345 字符")

### Test 1.2: Real-time Update
- [ ] Type in the textarea
- [ ] Verify count updates immediately
- [ ] Delete text
- [ ] Verify count decreases
- [ ] Paste large text
- [ ] Verify count updates correctly

### Test 1.3: Edge Cases
- [ ] Empty textarea → Count shows "0 字符"
- [ ] Very long text (>10,000 chars) → Count shows with separator
- [ ] Special characters → Count includes them
- [ ] Line breaks → Count includes them

**Expected**: Character count is always accurate and updates in real-time

---

## 2. Custom Reset Confirmation Modal

### Test 2.1: Modal Appearance
- [ ] Click "重置为默认" button
- [ ] Modal appears centered on screen
- [ ] Backdrop is semi-transparent black
- [ ] Warning icon (⚠️) is visible
- [ ] Title "确认重置" is displayed
- [ ] Warning message is clear and readable
- [ ] Two buttons visible: "取消" and "确认重置"

### Test 2.2: Cancel Action
- [ ] Click "重置为默认"
- [ ] Modal appears
- [ ] Click "取消" button
- [ ] Modal closes
- [ ] No changes to prompt
- [ ] No toast message

### Test 2.3: Confirm Action
- [ ] Edit the prompt
- [ ] Click "重置为默认"
- [ ] Modal appears
- [ ] Click "确认重置" button
- [ ] Modal closes
- [ ] Prompt resets to default
- [ ] Success toast: "已重置为默认配置"
- [ ] Character count updates
- [ ] "有未保存的更改" indicator disappears

### Test 2.4: Modal Styling
- [ ] Modal matches app theme (dark mode)
- [ ] Text is readable
- [ ] Buttons have hover effects
- [ ] "确认重置" button is red (danger color)
- [ ] "取消" button is neutral
- [ ] Modal is responsive on mobile

### Test 2.5: Backdrop Behavior
- [ ] Click backdrop (outside modal)
- [ ] Modal should NOT close (intentional)
- [ ] Only buttons can close modal

**Expected**: Professional, clear confirmation modal that prevents accidental resets

---

## 3. Save Button Functionality

### Test 3.1: Initial State
- [ ] Load Prompt Config tab
- [ ] Save button should be disabled (gray)
- [ ] Button text: "保存配置"
- [ ] Cursor shows "not-allowed" on hover

### Test 3.2: Enable on Changes
- [ ] Edit prompt text
- [ ] Save button becomes enabled (blue)
- [ ] "有未保存的更改" indicator appears
- [ ] Button is clickable

### Test 3.3: Save Success
- [ ] Edit prompt
- [ ] Click "保存配置"
- [ ] Button shows "保存中..."
- [ ] Button is disabled during save
- [ ] Success toast: "配置已保存"
- [ ] Button returns to disabled state
- [ ] "有未保存的更改" indicator disappears
- [ ] Character count remains accurate

### Test 3.4: Save with Validation
- [ ] Edit prompt
- [ ] Click "验证提示词"
- [ ] Validation passes
- [ ] Click "保存配置"
- [ ] Save succeeds
- [ ] Validation result clears

### Test 3.5: Save Error Handling
- [ ] Disconnect network
- [ ] Edit prompt
- [ ] Click "保存配置"
- [ ] Error toast appears
- [ ] Button returns to enabled state
- [ ] Changes are not lost

### Test 3.6: No Changes
- [ ] Load tab (no edits)
- [ ] Click disabled save button
- [ ] Info toast: "没有需要保存的更改"

### Test 3.7: Multiple Fields
- [ ] Edit prompt text
- [ ] Edit strategy name
- [ ] Edit description
- [ ] Save button is enabled
- [ ] Click save
- [ ] All fields are saved
- [ ] All fields update correctly

**Expected**: Save button works reliably, provides clear feedback, handles errors gracefully

---

## 4. Integration Tests

### Test 4.1: Character Count + Validation
- [ ] Type in textarea
- [ ] Character count updates
- [ ] Click "验证提示词"
- [ ] Validation shows final length
- [ ] Compare: textarea count vs validation final length
- [ ] Final length should be much larger (includes workflow)

### Test 4.2: Validation + Save
- [ ] Edit prompt
- [ ] Click "验证提示词"
- [ ] Validation passes
- [ ] Click "保存配置"
- [ ] Save succeeds
- [ ] Validation result clears after save

### Test 4.3: Reset + Save
- [ ] Edit prompt
- [ ] Click "重置为默认"
- [ ] Confirm reset
- [ ] Prompt resets
- [ ] Save button is disabled (no changes)
- [ ] Character count shows default length

### Test 4.4: Full Workflow
- [ ] Load tab
- [ ] Check initial character count
- [ ] Edit prompt
- [ ] Character count updates
- [ ] "有未保存的更改" appears
- [ ] Click "验证提示词"
- [ ] Validation passes
- [ ] Click "保存配置"
- [ ] Save succeeds
- [ ] All indicators reset
- [ ] Click "重置为默认"
- [ ] Confirm reset
- [ ] Back to default state

**Expected**: All features work together seamlessly

---

## 5. Visual/UX Tests

### Test 5.1: Responsive Design
- [ ] Desktop (1920x1080): All elements visible and properly spaced
- [ ] Laptop (1366x768): No horizontal scroll, readable
- [ ] Tablet (768x1024): Modal fits screen, buttons accessible
- [ ] Mobile (375x667): Modal is readable, buttons are tappable

### Test 5.2: Dark Mode
- [ ] All text is readable
- [ ] Buttons have good contrast
- [ ] Modal backdrop is visible
- [ ] Warning icon stands out

### Test 5.3: Animations
- [ ] Modal fade in/out is smooth
- [ ] Button hover effects work
- [ ] Transitions are not jarring

### Test 5.4: Loading States
- [ ] Initial load shows spinner
- [ ] Save shows "保存中..."
- [ ] Validate shows "验证中..."
- [ ] Reset shows appropriate state

**Expected**: Professional, polished UI that works on all devices

---

## 6. Edge Cases

### Test 6.1: Very Long Prompt
- [ ] Paste 40,000 character prompt
- [ ] Character count shows correctly
- [ ] Validation works
- [ ] Save works
- [ ] No performance issues

### Test 6.2: Empty Prompt
- [ ] Delete all text
- [ ] Character count shows "0 字符"
- [ ] Validation button is disabled
- [ ] Try to save
- [ ] Backend should reject (too short)

### Test 6.3: Special Characters
- [ ] Type emoji: 😀🎉
- [ ] Type Chinese: 你好世界
- [ ] Type symbols: @#$%^&*
- [ ] Character count is accurate
- [ ] Save works

### Test 6.4: Rapid Actions
- [ ] Click save multiple times quickly
- [ ] Only one save request should fire
- [ ] Click reset while saving
- [ ] Should wait for save to complete

### Test 6.5: Network Issues
- [ ] Start save
- [ ] Disconnect network mid-save
- [ ] Error handling works
- [ ] Can retry save

**Expected**: Robust handling of edge cases

---

## 7. Accessibility

### Test 7.1: Keyboard Navigation
- [ ] Tab through all elements
- [ ] Focus states are visible
- [ ] Enter key works on buttons
- [ ] Escape key closes modal (if implemented)

### Test 7.2: Screen Reader
- [ ] Labels are announced
- [ ] Button states are announced
- [ ] Modal content is announced
- [ ] Error messages are announced

### Test 7.3: Color Contrast
- [ ] Text meets WCAG AA standards
- [ ] Buttons are distinguishable
- [ ] Warning colors are clear

**Expected**: Accessible to all users

---

## Test Results Template

```
Date: ___________
Tester: ___________
Browser: ___________
Screen Size: ___________

Character Count Display: ☐ Pass ☐ Fail
Reset Modal: ☐ Pass ☐ Fail
Save Button: ☐ Pass ☐ Fail
Integration: ☐ Pass ☐ Fail
Visual/UX: ☐ Pass ☐ Fail
Edge Cases: ☐ Pass ☐ Fail
Accessibility: ☐ Pass ☐ Fail

Notes:
_________________________________
_________________________________
_________________________________

Overall: ☐ Pass ☐ Fail
```

---

## Automated Testing (Future)

```typescript
// Example Playwright test
test('character count updates on input', async ({ page }) => {
  await page.goto('/intraday-trading');
  await page.click('text=提示词配置');
  
  const textarea = page.locator('textarea');
  const count = page.locator('text=/\\d+ 字符/');
  
  await textarea.fill('Hello World');
  await expect(count).toHaveText('11 字符');
  
  await textarea.fill('');
  await expect(count).toHaveText('0 字符');
});

test('reset modal appears and works', async ({ page }) => {
  await page.goto('/intraday-trading');
  await page.click('text=提示词配置');
  
  await page.click('text=重置为默认');
  await expect(page.locator('text=确认重置')).toBeVisible();
  
  await page.click('text=取消');
  await expect(page.locator('text=确认重置')).not.toBeVisible();
});

test('save button enables on changes', async ({ page }) => {
  await page.goto('/intraday-trading');
  await page.click('text=提示词配置');
  
  const saveButton = page.locator('text=保存配置');
  await expect(saveButton).toBeDisabled();
  
  await page.locator('textarea').fill('New content');
  await expect(saveButton).toBeEnabled();
});
```

---

## Summary

This comprehensive test checklist covers:
- ✅ All three new features
- ✅ Integration between features
- ✅ Edge cases and error handling
- ✅ Visual and UX aspects
- ✅ Accessibility
- ✅ Responsive design

**Estimated Testing Time**: 30-45 minutes for complete manual testing
