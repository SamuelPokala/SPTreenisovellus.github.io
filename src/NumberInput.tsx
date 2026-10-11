import {useEffect,useRef,useState,type InputHTMLAttributes} from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'type'> & {value: number};
/** Keep editing text separate from the committed number so clearing is possible. */
export function NumberInput({value,onChange,onFocus,onBlur,...props}: Props) {
  const [text,setText]=useState(String(value));
  const focused=useRef(false);
  useEffect(()=>{if(!focused.current)setText(String(value))},[value]);
  return <input {...props} type="number" value={text}
    onFocus={event=>{focused.current=true;event.currentTarget.select();onFocus?.(event)}}
    onChange={event=>{
      const raw=event.currentTarget.value;
      // Remove accidental leading zeros while preserving decimal editing.
      const next=raw.replace(/^0+(?=\d)/,'');
      setText(next);
      if(next!=='' && event.currentTarget.validity.valid){
        event.currentTarget.value=next;
        onChange?.(event);
      }
    }}
    onBlur={event=>{focused.current=false;setText(String(value));onBlur?.(event)}}
  />;
}
