import { useCallback, useRef, type ComponentProps } from 'react'
import CodeMirror from '@uiw/react-codemirror'

type Props = ComponentProps<typeof CodeMirror>

// React status/cursor updates must not reconfigure CodeMirror during mouse selection.
export default function StableCodeMirror(props: Props) {
  const handlers = useRef(props)
  handlers.current = props
  const onChange = useCallback<NonNullable<Props['onChange']>>((...args) => handlers.current.onChange?.(...args), [])
  const onUpdate = useCallback<NonNullable<Props['onUpdate']>>((...args) => handlers.current.onUpdate?.(...args), [])
  const onCreateEditor = useCallback<NonNullable<Props['onCreateEditor']>>((...args) => handlers.current.onCreateEditor?.(...args), [])
  return <CodeMirror {...props} onChange={onChange} onUpdate={onUpdate} onCreateEditor={onCreateEditor}/>
}
