
"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, DropdownProps } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants, Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { ScrollArea } from "./scroll-area"

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  onApply?: (date: Date | undefined) => void;
  onCancel?: () => void;
};

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  onApply,
  onCancel,
  ...props
}: CalendarProps) {
  // Use internal state to track the selection until 'Apply' is clicked
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(props.selected as Date);

  // Sync internal state if the external prop changes
  React.useEffect(() => {
    setSelectedDate(props.selected as Date);
  }, [props.selected]);

  const handleApply = () => {
    onApply?.(selectedDate);
  };

  const handleCancel = () => {
    // Reset internal state to original prop on cancel
    setSelectedDate(props.selected as Date);
    onCancel?.();
  }

  return (
    <div>
      <DayPicker
        showOutsideDays={showOutsideDays}
        className={cn("p-3", className)}
        selected={selectedDate}
        onSelect={setSelectedDate}
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-4",
          caption: "flex justify-center pt-1 relative items-center",
          caption_label: "hidden text-sm font-medium",
          caption_dropdowns: "flex justify-center gap-2 items-center",
          nav: "space-x-1 flex items-center",
          nav_button: cn(
            buttonVariants({ variant: "outline" }),
            "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
          ),
          table: "w-full border-collapse space-y-1",
          head_row: "flex",
          head_cell:
            "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
          row: "flex w-full mt-2",
          cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
          day: cn(
            buttonVariants({ variant: "ghost" }),
            "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
          ),
          day_range_end: "day-range-end",
          day_selected:
            "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
          day_today: "bg-accent text-accent-foreground",
          day_outside:
            "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
          day_disabled: "text-muted-foreground opacity-50",
          day_range_middle:
            "aria-selected:bg-accent aria-selected:text-accent-foreground",
          day_hidden: "invisible",
          ...classNames,
        }}
        components={{
            IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
            IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
            Dropdown: ({ value, onChange, children, ...props }: DropdownProps) => {
            const options = React.Children.toArray(children) as React.ReactElement<React.HTMLProps<HTMLOptionElement>>[];
            const selected = options.find((child) => child.props.value === value);
            const handleChange = (value: string) => {
                const changeEvent = {
                target: { value },
                } as React.ChangeEvent<HTMLSelectElement>;
                onChange?.(changeEvent);
            };
            return (
                <Select
                value={value?.toString()}
                onValueChange={(value) => {
                    handleChange(value);
                }}
                >
                <SelectTrigger className="w-auto focus:ring-0 focus:ring-offset-0 border-0 h-7 px-2 font-medium">
                    <SelectValue>{selected?.props?.children}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                    <ScrollArea className="h-48">
                    {options.map((option, id: number) => (
                        <SelectItem
                        key={`${option.props.value}-${id}`}
                        value={option.props.value?.toString() ?? ""}
                        >
                        {option.props.children}
                        </SelectItem>
                    ))}
                    </ScrollArea>
                </SelectContent>
                </Select>
            )
            }
        }}
        {...props}
        mode="single"
      />
      {(onApply || onCancel) && (
        <div className="flex justify-end gap-2 p-3 pt-0 border-t">
          {onCancel && <Button variant="ghost" onClick={handleCancel}>Cancel</Button>}
          {onApply && <Button onClick={handleApply}>Apply</Button>}
        </div>
      )}
    </div>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }

    