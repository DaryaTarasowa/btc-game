import { Modal, type ModalProps } from "@/components/Modal/Modal";

interface InfoModalProps {
  onClose: ModalProps["onClose"];
}

export function InfoModal({ onClose }: InfoModalProps) {
  return (
    <Modal
      className="w-[min(120%,420px)]"
      onClose={onClose}
      eyebrow="How to play"
      contained={true}
    >
      <div className={`text-white`}>
        <p>Choose whether you think the price will go UP or DOWN.</p>
        <p>Your bet starts at the price shown on the chart.</p>
        <p>After 60 seconds, the next price change decides the result.</p>
        <p>Guess correctly and earn +1 point.</p>
      </div>
    </Modal>
  );
}
