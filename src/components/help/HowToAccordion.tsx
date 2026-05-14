import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export type HowToItem = {
  id: string;
  question: string;
  steps: (string | React.ReactNode)[];
};

interface Props {
  items: HowToItem[];
}

export function HowToAccordion({ items }: Props) {
  return (
    <Accordion type="multiple" className="w-full">
      {items.map((item) => (
        <AccordionItem key={item.id} value={item.id}>
          <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
          <AccordionContent>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
              {item.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
