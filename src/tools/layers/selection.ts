// 目前選到哪個物件（介面狀態，不進復原紀錄）；面板和照片上的操作層共用

import { create } from 'zustand'

export const useSelection = create<{ selected: string | null }>(() => ({ selected: null }))

export const select = (id: string | null) => useSelection.setState({ selected: id })
