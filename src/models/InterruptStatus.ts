export interface InterruptStatus {
  isInterruptible: boolean
}

export const Interruptible: InterruptStatus = {
  isInterruptible: true
}
export const Uninterruptible: InterruptStatus = {
  isInterruptible: false
}
