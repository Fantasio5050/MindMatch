import type { Group, Member } from '../src/types'

export interface StoredMember extends Member {
  token: string
}

export interface StoredGroup extends Omit<Group, 'members'> {
  members: StoredMember[]
}

export interface Database {
  groups: StoredGroup[]
}
