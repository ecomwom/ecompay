export type CheckoutState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Submitted values, used to repopulate the form after a validation error. */
  values?: Record<string, string>;
  /**
   * Token the next submit must use; set on every action result (the submitted one,
   * or a fresh one once the submitted token is dead). Absent only in the initial state.
   */
  checkoutToken?: string;
};

export const initialCheckoutState: CheckoutState = {};
