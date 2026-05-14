import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export type FAQItem = {
  id: string;
  question: string;
  answer: React.ReactNode;
};

interface Props {
  items: FAQItem[];
}

export function HelpFAQ({ items }: Props) {
  return (
    <Accordion type="multiple" className="w-full">
      {items.map((item) => (
        <AccordionItem key={item.id} value={item.id}>
          <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
          <AccordionContent>
            <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
              {item.answer}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
