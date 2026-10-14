"use client";

import { useId } from "react";
import styles from "./shared.module.css";

// A segmented control built from radio inputs. `options` are { label, value }; values may be
// numbers or BigInts, compared with ===.
export default function Segmented({ legend, options, value, onChange }) {
  const name = useId();
  return (
    <fieldset className={styles.field}>
      <legend className={styles.label}>{legend}</legend>
      <div className={styles.seg}>
        {options.map((option) => (
          <label key={option.label}>
            <input type="radio" name={name} checked={option.value === value} onChange={() => onChange(option.value)} />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
